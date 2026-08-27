# Marketing imagery credits

Photos from [Pexels](https://www.pexels.com), used under the Pexels license (free to use, attribution not required — credited here anyway).

| File | Source |
|---|---|
| `pexels-kid-saving-7118210.jpg` | https://www.pexels.com/photo/7118210/ |
| `pexels-kid-piggybank-12955547.jpg` | https://www.pexels.com/photo/12955547/ |
| `pexels-learning-group.jpg` | https://www.pexels.com/photo/children-collaborating-in-a-classroom-setting-34526413/ |
| `pexels-classroom-learning.jpg` | https://www.pexels.com/photo/children-learning-in-classroom-setting-31152359/ |
| `pexels-playful-learning.jpg` | https://www.pexels.com/photo/kids-playing-with-teacher-in-the-classroom-8363102/ |
| `pexels-classwork.jpg` | https://www.pexels.com/photo/children-studying-inside-a-classroom-8466695/ |
| `atlas/3985092.jpg` | https://www.pexels.com/photo/family-doing-shopping-in-the-grocery-store-3985092/ |
| `atlas/3985077.jpg` | https://www.pexels.com/photo/grocery-shopping-with-family-3985077/ |
| `atlas/3985081.jpg` | https://www.pexels.com/photo/family-grocery-shopping-3985081/ |
| `atlas/3985056.jpg` | https://www.pexels.com/photo/family-doing-shopping-in-the-grocery-store-3985056/ |
| `atlas/12357525.jpg` | https://www.pexels.com/photo/saving-graphic-design-with-piggy-bank-12357525/ |
| `atlas/7646224.jpg` | https://www.pexels.com/photo/piggy-bank-in-protective-mask-and-crown-with-coins-7646224/ |
| `atlas/12357425.jpg` | https://www.pexels.com/photo/man-holding-a-piggy-bank-and-a-mini-shopping-cart-12357425/ |
| `atlas/34383963.jpg` | https://www.pexels.com/photo/piggy-bank-on-euro-notes-promoting-savings-34383963/ |
| `atlas/12357524.jpg` | https://www.pexels.com/photo/a-piggy-bank-on-the-table-12357524/ |
| `atlas/34471650.jpg` | https://www.pexels.com/photo/family-picnic-in-scenic-countryside-setting-34471650/ |
| `atlas/32760477.jpg` | https://www.pexels.com/photo/child-engaged-in-craft-activity-at-home-32760477/ |
| `atlas/8798702.jpg` | https://www.pexels.com/photo/happy-family-baking-in-the-kitchen-8798702/ |
| `atlas/8208755.jpg` | https://www.pexels.com/photo/a-family-having-picnic-in-the-park-8208755/ |
| `atlas/4894603.jpg` | https://www.pexels.com/photo/father-and-daughter-gardening-4894603/ |
| `atlas/5082866.jpg` | https://www.pexels.com/photo/father-looking-after-his-two-children-in-the-kitchen-5082866/ |
| `atlas/9207491.jpg` | https://www.pexels.com/photo/family-having-picnic-on-grass-9207491/ |
| `atlas/7669175.jpg` | https://www.pexels.com/photo/family-doing-picnic-together-7669175/ |
| `atlas/7938020.jpg` | https://www.pexels.com/photo/family-reading-a-book-7938020/ |
| `atlas/15955290.jpg` | https://www.pexels.com/photo/kids-standing-in-front-of-a-market-stall-on-a-city-street-15955290/ |
| `atlas/8213262.jpg` | https://www.pexels.com/photo/parents-reading-their-daughter-a-story-8213262/ |
| `atlas/7489083.jpg` | https://www.pexels.com/photo/a-family-playin-at-the-table-7489083/ |
| `atlas/7671313.jpg` | https://www.pexels.com/photo/kids-planting-outdoors-7671313/ |
| `atlas/6274956.jpg` | https://www.pexels.com/photo/a-mother-reading-a-book-to-her-daughter-6274956/ |
| `atlas/4609073.jpg` | https://www.pexels.com/photo/a-mother-and-her-children-reading-a-book-together-at-home-4609073/ |

`/logo-main.png`, `/Hero-Families.webp` and the favicons are LittleFounders brand assets (recovered from the v1 `main` branch). The social share cards in `/og/` are generated from `scripts/seo/og-card.html` by `npm run seo:cards` — they are built from the wordmark and the mentor busts, so they carry no third-party imagery. They replaced `og-image.png`, a stock-style photo that named neither the product nor its promise and whose on-screen text was AI-garbled nonsense.

`/logo-main-trimmed.png` is a derivative of `/logo-main.png`: the source canvas is 8000×4500 with the wordmark occupying only its central ~23% (huge transparent margins), which made the logo look tiny in the header/footer no matter the CSS height. Trimmed to the alpha-channel content bounding box (+40px padding) via Pillow — `frontend/public/logo-main.png` bbox `(1034, 1605, 6966, 2621)`. Use the trimmed file in UI; keep the original as the untouched brand source.
