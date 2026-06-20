For simplicity, the comparison only focuses on the intervals given in different rating sequences. The ratings in (re)learning steps will be ignored, only consider the first rating of new cards.

The default parameters of FSRS for comparison: 
```javascript
var w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
```

# Case one: press `good` continuously, with different first ratings.

Rating sequence: `1,3,3,3,3,3,3,3,3,3`

Anki's intervals: `1d,3d,8d,20d,1.7m,4.2m,10.4m,2.1y,5.4y,13.4y`

FSRS's intervals: `1d,2d,6d,14d,1.1m,2.3m,4.7m,9.1m,1.4y,2.5y`

***

Rating sequence: `2,3,3,3,3,3,3,3,3,3`

Anki's intervals: `1d,3d,8d,20d,1.7m,4.2m,10.4m,2.1y,5.4y,13.4y`

FSRS's intervals: `1d,3d,9d,24d,1.9m,4.4m,9.5m,1.6y,3.1y,5.7y`

*** 

Rating sequence: `3,3,3,3,3,3,3,3,3,3`

Anki's intervals: `1d,3d,8d,20d,1.7m,4.2m,10.4m,2.1y,5.4y,13.4y`

FSRS's intervals: `2d,7d,21d,1.9m,4.8m,11.2m,2.0y,4.1y,8.1y,15.0y`

***

Rating sequence: `4,3,3,3,3,3,3,3,3,3`

Anki's intervals: `4d,10d,25d,2.1m,5.3m,1.1y,2.7y,6.8y,16.9y,42.3y`

FSRS's intervals: `6d,20d,2.0m,5.5m,1.1y,2.6y,5.6y,11.5y,22.3y,41.4y`
