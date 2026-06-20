# Command Line 

There is a python package for the optimizer. This package has torch as a dependency, so note it might take about half a gigabyte of space.

## Installation

Install the package with the command:

```
python -m pip install fsrs_optimizer
```

You should upgrade regularly to make sure you have the most recent version of [FSRS-Optimizer](https://github.com/open-spaced-repetition/fsrs-optimizer):

```
python -m pip install fsrs_optimizer --upgrade
```

## Usage

Export your deck and cd into the folder to which you exported it.  
Then you can run:

```
python -m fsrs_optimizer "package.(colpkg/apkg)"
```

You can also list multiple files, e.g.:

```
python -m fsrs_optimizer "file1.akpg" "file2.apkg"
```

Wildcards are supported:

```
python -m fsrs_optimizer *.apkg
```

There are certain options which are as follows:

```
options:
  -h, --help           show this help message and exit
  -y, --yes, --no-yes  If set automatically defaults on all stdin settings.
  -o OUT, --out OUT    File to APPEND the automatically generated profile to.
```

## Expected Functionality

![image](https://github.com/Luc-mcgrady/fsrs4anki/assets/63685643/ac2e8ae0-726c-46fd-b110-0701fa87cb66)

![image](https://github.com/Luc-mcgrady/fsrs4anki/assets/63685643/1fe8b0bb-7ac0-4a31-b594-465239ea3a1e)

# Anki Addon **EXPERIMENTAL** (Anki <= 2.1.66)

Download and install [this](https://github.com/Luc-mcgrady/fsrs4anki-helper/tree/optimizer) version of the anki helper addon either by git cloning it into the anki addons folder or [downloading it as a zip](https://github.com/Luc-mcgrady/fsrs4anki-helper/archive/refs/heads/optimizer.zip) and extracting the zip into the anki addons folder.

Install the optimizer locally.

![image](https://user-images.githubusercontent.com/63685643/236647263-b1e57db1-4ad0-441b-9abe-91cbd36c13b0.png)  

Please pay attention to the popup.

![image](https://github.com/Luc-mcgrady/fsrs4anki/assets/63685643/ebe42eb4-f63d-4e58-b593-c173891dd29c)

After that has downloaded and installed you should be able to run the optimizer from within anki.

Press the cog next to any given deck and hit the optimize option.  

![image](https://user-images.githubusercontent.com/63685643/236647245-757ca803-b8cf-41cd-a1ae-8ed9af852ad8.png)  

Anki may then hang a small while while it loads the optimizer.

![image](https://github.com/Luc-mcgrady/fsrs4anki/assets/63685643/e160e5ba-c51f-46a9-9813-9dceb18e47ff)  

Hit yes to find the optimum retention, Hit no to not or hit cancel to pick a different deck. 

If all is well you should then get a toolbar popup which tells you the progress of the optimization.

![image](https://user-images.githubusercontent.com/63685643/236647707-38101c10-ccd2-4417-aa3f-f2e4e10bb4c3.png)

You should then get the stats in a format which is easy to copy into the javascript scheduler.

![image](https://user-images.githubusercontent.com/63685643/236647716-bfd8099a-6e7f-46e7-bce8-e18e75e75d46.png)  

These values are saved in the addons config file which can be found and edited in anki if you want to change the retention manually for example.

![image](https://user-images.githubusercontent.com/63685643/236647915-7a865bb0-f057-4404-af0f-27c81be99082.png)

If there are any issues with this please mention them on this pull request [here](https://github.com/open-spaced-repetition/fsrs4anki-helper/pull/91).