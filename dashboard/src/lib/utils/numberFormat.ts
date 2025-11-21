/**
 * Number Formatting Utilities
 *
 * Provides consistent number formatting for token counts, costs, and usage indicators.
 * Used by ClaudeUsageBar and other components that display usage metrics.
 */

/**
 * Format token count with appropriate suffix
 *
 * @param tokens - Number of tokens to format
 * @returns Formatted string with K/M suffix for large numbers
 *
 * @example
 * formatTokens(500)       // "500"
 * formatTokens(50000)     // "50,000"
 * formatTokens(1500000)   // "1.50 M"
 * formatTokens(2345678)   // "2.35 M"
 */
export function formatTokens(tokens: number): string {
	// Handle edge cases
	if (!isFinite(tokens)) return 'N/A';
	if (tokens < 0) return '0';

	// Less than 1,000: no formatting
	if (tokens < 1000) {
		return Math.round(tokens).toString();
	}

	// 1,000 - 999,999: use commas
	if (tokens < 1_000_000) {
		return new Intl.NumberFormat('en-US').format(Math.round(tokens));
	}

	// 1M+: use M suffix with 2 decimal places
	const millions = tokens / 1_000_000;
	return `${millions.toFixed(2)} M`;
}

/**
 * Format cost as USD currency
 *
 * @param cost - Cost in dollars
 * @returns Formatted currency string with $ prefix
 *
 * @example
 * formatCost(0.5)      // "$0.50"
 * formatCost(15.234)   // "$15.23"
 * formatCost(1000)     // "$1,000.00"
 */
export function formatCost(cost: number): string {
	// Handle edge cases
	if (!isFinite(cost)) return 'N/A';
	if (cost < 0) return '$0.00';

	// Use Intl.NumberFormat for locale-aware currency formatting
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(cost);
}

/**
 * Get DaisyUI color class based on token usage thresholds
 *
 * @param tokens - Number of tokens used
 * @param type - Time period ('today' or 'week')
 * @returns DaisyUI color class name
 *
 * @example
 * getUsageColor(50000, 'today')    // 'success' (green)
 * getUsageColor(300000, 'today')   // 'warning' (yellow)
 * getUsageColor(1200000, 'today')  // 'error' (red)
 */
export function getUsageColor(tokens: number, type: 'today' | 'week'): string {
	// Handle edge cases
	if (!isFinite(tokens) || tokens < 0) return 'info';

	if (type === 'today') {
		// Today thresholds
		if (tokens < 100_000) return 'success';      // < 100K: green
		if (tokens < 500_000) return 'info';         // 100K-500K: blue
		if (tokens < 1_000_000) return 'warning';    // 500K-1M: yellow/orange
		return 'error';                               // > 1M: red
	} else {
		// Week thresholds (more lenient)
		if (tokens < 500_000) return 'success';      // < 500K: green
		if (tokens < 2_000_000) return 'info';       // 500K-2M: blue
		if (tokens < 5_000_000) return 'warning';    // 2M-5M: yellow/orange
		return 'error';                               // > 5M: red
	}
}

/**
 * Get human-readable description of usage level
 *
 * @param tokens - Number of tokens used
 * @param type - Time period ('today' or 'week')
 * @returns Description string
 *
 * @example
 * getUsageLevel(50000, 'today')    // 'Low usage'
 * getUsageLevel(600000, 'today')   // 'High usage'
 * getUsageLevel(1200000, 'today')  // 'Very high usage'
 */
export function getUsageLevel(tokens: number, type: 'today' | 'week'): string {
	const color = getUsageColor(tokens, type);

	switch (color) {
		case 'success':
			return 'Low usage';
		case 'info':
			return 'Moderate usage';
		case 'warning':
			return 'High usage';
		case 'error':
			return 'Very high usage';
		default:
			return 'Unknown';
	}
}

/**
 * Format percentage with appropriate decimal places
 *
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(45.678)    // "45.7%"
 * formatPercentage(100)       // "100.0%"
 * formatPercentage(0.123, 2)  // "0.12%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
	if (!isFinite(value)) return 'N/A';
	if (value < 0) return '0.0%';
	if (value > 100) return '100.0%';

	return `${value.toFixed(decimals)}%`;
}
