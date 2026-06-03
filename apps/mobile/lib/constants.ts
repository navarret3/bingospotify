const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

function normalizeApiBaseUrl(value: string | undefined): string {
	if (!value) {
		return "http://localhost:4000";
	}

	const withProtocol = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
	return withProtocol.replace(/\/$/, "");
}

export const API_BASE_URL = normalizeApiBaseUrl(rawApiBaseUrl);
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
