import base64
import os
import unittest
from unittest.mock import patch

os.environ["PAPERORCHESTRA_ENGINE_TOKEN"] = "paperorchestra-ci-engine-token"

from fastapi.testclient import TestClient
from backend.main import app


class ComputeApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.headers = {"Authorization": "Bearer paperorchestra-ci-engine-token"}

    def test_health_reports_latexmk_available(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertTrue(payload["latexmk"])

    def test_plot_endpoint_returns_valid_png_and_pdf(self):
        response = self.client.post(
            "/api/generate-plot",
            headers=self.headers,
            json={
                "data": [{"month": "Jan", "value": 12}, {"month": "Feb", "value": 18}],
                "x": "month",
                "y": "value",
                "title": "CI plotting smoke test",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        payload = response.json()
        png = base64.b64decode(payload["png_base64"], validate=True)
        pdf = base64.b64decode(payload["pdf_base64"], validate=True)
        self.assertTrue(png.startswith(b"\x89PNG\r\n\x1a\n"))
        self.assertTrue(pdf.startswith(b"%PDF-"))

    def test_latex_endpoint_compiles_a_real_pdf(self):
        response = self.client.post(
            "/api/compile-latex",
            headers=self.headers,
            json={
                "tex": r"\documentclass{article}\begin{document}PaperOrchestra PDF smoke test.\end{document}",
                "bibtex": "",
                "files": {},
                "assets": {},
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        pdf = base64.b64decode(response.json()["pdf_base64"], validate=True)
        self.assertTrue(pdf.startswith(b"%PDF-"))

    def test_compute_endpoints_reject_missing_bearer_token(self):
        response = self.client.post(
            "/api/generate-plot",
            json={"data": [{"x": "A", "y": 1}], "x": "x", "y": "y"},
        )
        self.assertEqual(response.status_code, 401)



    def test_rate_limit_middleware_returns_429_and_uses_forwarded_client_ip(self):
        denied = {"allowed": False, "limit": 20, "remaining": 0, "retry_after": 17}
        with patch("backend.rate_limit.consume_rate_limit", return_value=denied) as consume:
            response = self.client.post(
                "/api/generate-plot",
                headers={
                    **self.headers,
                    "X-Forwarded-For": "198.51.100.23",
                },
                json={"data": [{"x": "A", "y": 1}], "x": "x", "y": "y"},
            )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["retry-after"], "17")
        self.assertEqual(response.headers["x-ratelimit-limit"], "20")
        consume.assert_called_once_with("generate-plot", "198.51.100.23")


if __name__ == "__main__":
    unittest.main()
