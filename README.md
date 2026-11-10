# TallyUp

Photograph a restaurant bill, tap who had what, and see exactly what everyone owes, with tax, service charge and tip shared fairly.

No sign-up, no server, no app to install. It is a static web page, and the receipt photo is read on your own device.

## How it works

1. **Snap the bill.** The photo is read in your browser with [Tesseract.js](https://github.com/naptha/tesseract.js) OCR. Items, quantities, tax, service charge, tip and discount are picked out for you.
2. **Fix anything it got wrong.** Every item name and price is editable, and you can add items by hand if you have no receipt.
3. **Add the people** at the table.
4. **Tap who had what.** Tap one name for a personal dish, several for a shared one. Shared dishes split evenly.
5. **Get the totals.** Tax, service and tip are divided in proportion to what each person ordered, then everything is rounded so the shares add up to the exact bill, to the last cent or paisa. Copy the summary or share it from your phone.

## Run it

It is plain HTML, CSS and JavaScript.

```bash
npm start        # serves the folder at http://localhost:8080
npm test         # tests for the receipt parser and the splitting maths
```

You can also just open `index.html` in a browser. The OCR library loads from a CDN, so photo reading needs an internet connection. Everything else works offline.

## Design notes

- **Money is stored as whole cents or paise**, never as floating point, so totals never drift.
- **Largest-remainder rounding** (`src/split.js`) hands out the leftover cent fairly, so the people's shares always sum to the bill.
- **The parser** (`src/parse.js`) handles `2 x Item 180.00`, thousands separators (`1,250.00`), comma decimals (`12,50`), currency symbols, and extra-charge lines such as `CGST 2.5%  14.00` where the percentage must not be mistaken for the amount.
- **Privacy:** the image never leaves the page. There is no analytics and no backend.

## Known limits

- OCR quality depends on the photo. Straight, well lit and in focus works best. Crumpled or curved receipts may need manual fixes, which is why every field is editable.
- English text only for now.
- Tax and service are split by food share. A "split equally" option for them is a possible next step.

## License

MIT
