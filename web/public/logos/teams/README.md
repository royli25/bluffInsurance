Team marks used by the Bluff console. Sourced from ESPN's public team directory
(`https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams`); original
asset URLs and team names are recorded in `sources.json`. Marks belong to their
respective teams.

Images are transparent WebP assets with a maximum dimension of 96 px. Dark
background variants are used when ESPN provides them. NBA, NFL, and NHL include
the full team directories; college and soccer marks cover the market snapshot.

`src/lib/team-logos.json` maps league and Gemini team abbreviation to a local
asset. Keep leagues separate: the same abbreviation can identify different
teams. Unknown teams display their abbreviation until a logo is added.
