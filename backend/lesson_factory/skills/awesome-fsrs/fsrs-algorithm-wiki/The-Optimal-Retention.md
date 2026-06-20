aka **C**ompute **M**inimum **R**ecommended **R**etention (CMRR)

# Definition

When talking about spaced repetition, we are concerned about two factors:

1. How many flashcards will I remember? (knowledge acquisition)
2. How much time will it take? (workload in minutes of studying per day)

We want to remember as much as possible while spending as little time as possible. In FSRS, by choosing an appropriate value of the desired retention, we can either minimize the workload or maximize the knowledge acquisition.

Imagine we’re adding new cards constantly every day and doing reviews on time. Our knowledge acquisition will be high if we set a high desired retention.

Total knowledge can be taken as the sum of the probability of recall of each card.

Mathematically, $\text{knowledge} = \sum\limits_{i=1}^n R_i$, where $n$ is how many cards we’ve learned, and $R_i$ is the probability we can recall the i<sup>th</sup> card.

Below is a graph that shows how knowledge depends on desired retention. On all of the graphs in this article, the Y axis doesn't have values because they depend on many things (FSRS parameters, time spent per card, deck size, new card limit, etc.) and don't provide valuable insights. It's the overall shape that matters.

![image](https://github.com/user-attachments/assets/1fbaf201-6697-467e-adef-7bf5958e4184)

A high value of desired retention means we must review cards more often, which increases our workload. If we decrease the desired retention, the workload and the knowledge decrease. However, if the desired retention is very low, we forget a lot and have to relearn cards, again increasing our workload. So, there are two "forces" at play here:
1) As desired retention increases, intervals become shorter, which increases the number of reviews per day.
2) As desired retention decreases, we forget more and must re-learn more of our material.

As a result, if we plot the workload as a function of desired retention, the graph has a point of minimum workload.

**Note**: the following graphs are generated from the default parameters of FSRS. The real graphs vary among different learners.

![image](https://github.com/user-attachments/assets/57e1c61a-c288-401c-848a-8723d81c7ac7)

A similar graph is obtained if we divide workload by the acquired knowledge (the formula at the beginning of this article), which tells us how much we will have to study *relative* to how much we will remember. The value of the desired retention that corresponds to this minimum is slightly different.

![image](https://github.com/user-attachments/assets/b72af322-be5e-48ce-9065-7fd259779837)

Minimizing workload/knowledge seems to be more practical than minimizing the workload. Exaggerated example: if you had to study 30 minutes per day to achieve 80% retention and 31 minutes per day to achieve 90% retention, you would likely agree to study for one extra minute to remember 10% more.

# Simulation

With FSRS, it's possible to simulate the learning process in Anki.

Code: https://github.com/open-spaced-repetition/fsrs-rs/blob/0634cb08b08fecb96b0b8a9caba4a5e6938e85bb/src/optimal_retention.rs#L107-L407

Here's a step-by-step overview of the simulation:

1. **Initialization and Configuration Reading**:
   - Extract various parameters from the `SimulatorConfig` configuration, such as deck size, learning span (the number of days to simulate), maximum cost per day, etc. Here and hereafter "cost" refers to seconds of studying.
   - Initialize the `card_table` as a zero matrix, then fill it with initial values based on the configuration (like learning span and very small values for difficulty and stability).

2. **Initialize Daily Counters and Cost Arrays**:
   - Initialize arrays for daily review counts, learning counts, memorized counts, and total daily costs.

3. **Simulation Loop**:
   - For each day, within the learning span, perform the following steps:
     - Calculate the elapsed days since the last review (`delta_t`) and retrievability for learned cards based on the card's stability and last review date.
     - Determine which cards need to be reviewed and generate random values for these cards to later decide if they are forgotten. The probability that a user will press Good/Hard/Easy is estimated from the user's review history.
     - Based on retrievability and random values, determine which cards are forgotten and assign ratings to cards that need to be reviewed.
     - Update the cost of cards based on whether they are forgotten, their review ratings, and the cost parameters defined in the configuration. Cost parameters, such as how much time the user spends per card when he answers "Good" or "Again", are estimated from the user's review history.
     - Compute the cumulative sum of costs to determine which cards will be reviewed. Due to the daily maximum cost and review limits, not all cards can always be reviewed.
     - Determine which new cards need to be reviewed for the first time.
     - Randomly generate ratings for newly learned cards, and update their stability and difficulty.
     - Update cards' `last_date`, `stability`, `difficulty`, `interval`, and `due` fields.
     - Update daily review counts, learning counts, memorized counts, and total costs.

4. **Return Results**:
   - Return arrays of memorized counts, review counts, learning counts, and daily total costs.

The memorized count is the total knowledge acquired from the first day to the current day in the simulation. The review count is the number of cards reviewed during the current day. The learn count is the number of new cards learned during the current day. The daily total cost is time spent reviewing cards and learning new cards during the current day.

# Optimization

With the simulator, it's possible to predict the workload for each desired retention level. The optimizer uses [Brent's method](https://en.wikipedia.org/wiki/Brent%27s_method) to find the optimal retention.

Code: https://github.com/open-spaced-repetition/fsrs-rs/blob/0634cb08b08fecb96b0b8a9caba4a5e6938e85bb/src/optimal_retention.rs#L478-L589

Note: Before Anki 24.04, the goal was to maximize knowledge acquisition (the sum of all probabilities of recall), but in Anki 24.04+, the goal is to minimize workload/knowledge (minutes of studying divided by the aforementioned sum).