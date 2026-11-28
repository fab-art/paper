import unittest
from unittest.mock import patch

from backend.rate_limit import reset_rate_limits, consume_rate_limit


class ComputeRateLimitTests(unittest.TestCase):
    def setUp(self):
        reset_rate_limits()

    def test_plot_limit_allows_twenty_requests_and_rejects_the_twenty_first(self):
        results = [consume_rate_limit("generate-plot", "203.0.113.10", now=120.0) for _ in range(21)]
        self.assertTrue(all(result["allowed"] for result in results[:20]))
        self.assertFalse(results[20]["allowed"])
        self.assertEqual(results[20]["limit"], 20)
        self.assertEqual(results[20]["remaining"], 0)

    def test_latex_limit_allows_four_requests_and_rejects_the_fifth(self):
        results = [consume_rate_limit("compile-latex", "203.0.113.10", now=120.0) for _ in range(5)]
        self.assertTrue(all(result["allowed"] for result in results[:4]))
        self.assertFalse(results[4]["allowed"])
        self.assertEqual(results[4]["limit"], 4)

    def test_limits_are_isolated_by_client_ip(self):
        for _ in range(20):
            consume_rate_limit("generate-plot", "203.0.113.10", now=120.0)
        other_ip = consume_rate_limit("generate-plot", "203.0.113.11", now=120.0)
        self.assertTrue(other_ip["allowed"])

    def test_new_minute_starts_a_fresh_window(self):
        for _ in range(20):
            consume_rate_limit("generate-plot", "203.0.113.10", now=120.0)
        next_window = consume_rate_limit("generate-plot", "203.0.113.10", now=180.0)
        self.assertTrue(next_window["allowed"])
        self.assertEqual(next_window["remaining"], 19)



    def test_rate_limiter_bounds_tracked_client_buckets(self):
        with patch("backend.rate_limit.MAX_TRACKED_BUCKETS", 2):
            consume_rate_limit("generate-plot", "203.0.113.10", now=120.0)
            consume_rate_limit("generate-plot", "203.0.113.11", now=120.0)
            overflow = consume_rate_limit("generate-plot", "203.0.113.12", now=120.0)
        self.assertFalse(overflow["allowed"])
        self.assertEqual(overflow["remaining"], 0)


if __name__ == "__main__":
    unittest.main()
