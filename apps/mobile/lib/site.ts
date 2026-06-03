const rawSiteUrl = process.env.EXPO_PUBLIC_SITE_URL?.trim();

function normalizeSiteUrl(value: string | undefined): string {
	if (!value) {
		return "https://bingospotify.vercel.app";
	}

	const withProtocol = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
	return withProtocol.replace(/\/$/, "");
}

export const SITE_NAME = "Bingo Musical";
export const SITE_DESCRIPTION =
	"Crea un bingo musical con una playlist de Spotify, comparte un código y juega desde el móvil.";
export const SITE_URL = normalizeSiteUrl(rawSiteUrl);