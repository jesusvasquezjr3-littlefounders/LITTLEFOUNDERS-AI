This page was linked from elsewhere when I was searching for how to abuse Anki to remind me to do my reading. I was sad there wasn't anything here so this is what I hacked together using AnkiWebView Inspector. It is almost certainly an abuse of the system, but here goes. 

Put something like this in the Custom Scheduling section of your Deck options. This code will be run for every card, but it shouldn't affect any cards outside of a deck called "Readings". It does theoretically affect the scheduling for all your cards, so use at your own risk.

```javascript
if (ctx["deckName"] == "Readings") {
  console.log("using custom scheduling")
  states.again.normal.review.scheduledDays = 1
  states.hard.normal.review.scheduledDays = 1
  states.good.normal.review.scheduledDays = 1
  states.easy.normal.review.scheduledDays = 3
} else {
  console.log("Using normal scheduling")
}```