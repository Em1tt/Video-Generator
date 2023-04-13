# Video Compilation Generator

This utility fetches videos from a preconfigured subreddit, and creates a compilation out of them. It utilizes a queue system, which helps prevent lag on your device.

**To start using this utility, run:**

```bash
npm install
```

create a `tmp` folder

**Make sure your device has FFmpeg installed on it**  
Not sure how to install FFmpeg? [[Windows]](https://phoenixnap.com/kb/ffmpeg-windows) [[Linux]](https://phoenixnap.com/kb/install-ffmpeg-ubuntu)

Running the code: 
```bash
node .
#or
node index.js
```

## Default config.json
```json
{
    "dirs": {
        "output": "",
        "tmp": "./tmp/"
    },
    "input": {
        "subreddit": "escapefromtarkov",
        "sort": "top",
        "videos": 6,
        "ignoreFlairs": ["Discussion"],
        "query": "t=week"
    },
    "output": {
        "resolution": "1920x?",
        "aspect": "16:9",
        "showAuthors": true,
        "fileName": "output"
    },
    "settings": {
        "cleanCache": false,
        "silent": false
    }
}
```
