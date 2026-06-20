# Update

This wiki page describes the execution process of the custom scheduling code, which has been outdated since FSRS was integrated into Anki 23.10+ and AnkiDroid 2.17+.

# Requirement

To more deeply understand the working process of the FSRS4Anki scheduler, we recommend you install [AnkiWebView Inspector
](https://ankiweb.net/shared/info/31746032). The following text will use the screenshot with the `Inspector` window.

And please note, open the inspector before you start the review.

# How to see the execution of the scheduler?

Launch the inspector before you clicking `Study Now`, and then enter into a deck, you will see the following:

![image](https://user-images.githubusercontent.com/32575846/192134957-1c058d80-984e-4420-8206-5de5b404835a.png)

The left window shows the running code of custom scheduling.

`F10` or the button in the next figure is used to execute the code per line.

![image](https://user-images.githubusercontent.com/32575846/192135103-0cbe2eae-4e7e-449b-a1b6-70f4fb756900.png)

Important!: Don't click the `show answer` before the code run to the end. You can use `F8` to execute to the end.

# Details about the scheduler

There are three parts of the scheduler's code.

## Set parameters

Line 5-18 are setting the parameters for all cards. Line 24-40 are setting the parameters for a specific deck. 

> Related discussion: [[Question] How to workaround with Anki custom scheduling not being "Per Deck"](https://github.com/open-spaced-repetition/fsrs4anki/issues/7)

![image](https://user-images.githubusercontent.com/32575846/192135583-713edf25-4ca5-41ea-b5fb-3f61b9b8775d.png)

## Check the states of scheduling

Line 142-192 are used to check the scheduling states. In Anki, there are four types of states for card scheduling: `New`, `Learning`, `Review`, and `Relearning`. `Learning` and `Relearning` are the same in scheduling. And there are two types of decks: normal and filtered. In normal decks, all reviews will modify the interval of cards. But in filtered decks, only checking the box `Reschedule cards based on my answer in this deck` will allow Anki to update the interval of cards. The FSRS4Anki scheduler also supports filtered decks.

![image](https://user-images.githubusercontent.com/32575846/192136063-a8f777b6-b79d-4a2a-9c41-d018e80f49b0.png)

## Calculate memory states

The FSRS4Anki scheduler will calculate memory states from your rating and the DSR model. The scheduled interval is based on memory states and your custom parameters.

![image](https://user-images.githubusercontent.com/32575846/192137490-dba0944d-a163-469d-af2c-5e3f82efa0ce.png)

If the memory states are not available during review, the FSRS4Anki scheduler will convert the Anki's built-in scheduling information to the memory states. 

![image](https://user-images.githubusercontent.com/32575846/192137829-d987d748-5ff2-44a0-9aa3-d58d4cb52ebb.png)

The `interval` and `factor` of Anki's built-in scheduling, an SM-2 variation, will be automatically converted to the memory states of FSRS.

### Interval to Stability

If the card's memory states are empty, FSRS assumes that the $\text{Interval}$ given by Anki is equal to $\text{Stability} \times \text{Interval modifier}$, where
$\text{Interval modifier} = 9 \times \left(\frac{1}{\text{RequestRetention}} - 1 \right)$

So, $\text{Stability} = \text{Interval} / \text{Interval modifier}$ 

### Ease Factor to Difficulty

In SM-2, after a recall, the interval (stability) increases by the Ease Factor.

In FSRS, after a recall, the stability increases by a factor of $(1 + e^{w_8} \cdot (11-D) \cdot S^{-w_9} \cdot (e^{w_{10}\cdot(1-R)}-1) \cdot w_{15}(\textrm{if G = 2}) \cdot w_{16}(\textrm{if G = 4}))$.

If we equate these two, the Difficulty can be calculated as:

$$D = 11 - \cfrac{factor - 1}{e^{w_8}\cdot S^{-w_9}\cdot(e^{w_{10}\cdot(1-R)}-1)}.$$

After the stability and difficulty are calculated as above, they are used for the calculation of the next stability and the next difficulty (after the review).