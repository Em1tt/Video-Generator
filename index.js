// IMPORTS

const config = require("./config.json"),
       fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args)),
          fs = require("fs"),
      ffmpeg = require("fluent-ffmpeg"),
    readline = require('readline').createInterface({
                 input: process.stdin,
                 output: process.stdout
               });
let videos = [], 
     after = null,
 videoName = config.output.fileName;

// LOGIC

(async () => {
while (videos.length < config.input.videos) {
  await fetch(`https://www.reddit.com/r/${config.input.subreddit}/${config.input.sort}/.json?after=${after}&${config.input.query}`)
  .then(async (res) => {
    const result = await res.json();
    //Set the "after" query
    after = result.data.after;
    //Get posts and filter to keep only videos posted on Reddit (should remove imgur-based posts)
    let posts = result.data.children.filter((post) => {
      if (post.data.is_video && post.data.is_reddit_media_domain) return true;
    });
    //Iterate through posts
    for (const post of posts) {
      //If we reached the videos length, break out of loop
      if (videos.length > config.input.videos - 1) break;
      //If the post contains ignored flair, continue on to next post
      if (config.input.ignoreFlairs.includes(post.data?.link_flair_text)) continue;

      const id = post.data?.url?.split(".it/")[1],
      videoURL = post.data.media?.reddit_video.fallback_url;
      if(!id || !videoURL) continue;
      const audioURL = `https://v.redd.it/${id}/DASH_audio.mp4?source=fallback`;
      await processVideoSync(videoURL, audioURL, id, post.data.author);
    }
  });
}
handleMergeVideoSync();
})();

//FUNCTIONS

//Handles logging to console, ignores when silent is set to true
function handleLog(text){
  if(config.settings.silent) return;
  console.log(text);
};

//Handles cleaning cache, ignores when cleanCache is set to false
//Since this is the last function to run, we can exit the process from this function
function handleClean(){
  if(!config.settings.cleanCache || config.dirs.tmp == "" || config.dirs.tmp == "/") return process.exit(0);
  handleLog("\x1b[94m Cache: cleaning \x1b[0m");
  fs.rmSync(config.dirs.tmp, { recursive: true, force: true });
  fs.mkdirSync(config.dirs.tmp);
  handleLog("\x1b[92m Cache: cleaned \x1b[0m");
  process.exit(0);
};

//Promisifies stdin, upon input decides whether to generate a new file or overwrite old.

async function handleStdin(video){
  return new Promise((resolve, reject) => {
    readline.question(`\x1b[95m Video already exists: ${config.dirs.output+video+'.mp4'} \x1b[0m \n\x1b[93m Overwrite? (y/N): \x1b[0m`, res => {
      if(["y"].includes(res.toLowerCase())){
        return resolve();
      }else{
        let i = 1;
        while(fs.existsSync(config.dirs.output + video+i + '.mp4')){
          i = i+1;
        }
        videoName = video+i;
        return resolve();
      }
    });
  });
}

//Promisifies the process of merging videos
async function handleMergeVideoSync() {
  if(fs.existsSync(config.dirs.output + videoName + '.mp4')){
    //Command prompt:
    await handleStdin(videoName);
  };
  handleLog(`\x1b[94m Started Compiling to: ${videoName}.mp4 \x1b[0m`);
  return new Promise((resolve, reject) => {
    fs.writeFile(
      `${config.dirs.tmp}list.txt`,
      `ffconcat version 1.0\n` + videos
        .map((vid) => {
          return `file '${vid}'`;
        })
        .join("\n"),
      async (err) => {
        ffmpeg(`${config.dirs.tmp}list.txt`).inputFormat("concat").mergeToFile(config.dirs.output + videoName + '.mp4', config.dirs.tmp).on("end", () => {
          handleLog(`\x1b[92m Finished compiling to: ${videoName}.mp4 \x1b[0m`);
          handleClean();
          return resolve(videoName);
        });
      }
    );
  });
};

//Promisifies the process of encoding video and audio files together
function processVideoSync(videoURL, audioURL, id, author) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(`${config.dirs.tmp}${id}.mp4`)) {
      videos.push(id+".mp4");
      handleLog(`\x1b[93m Ignored video: ${id}.mp4 (file exists) \x1b[0m`);
      return resolve();
    }
    handleLog(`\x1b[94m Encoding video: ${id}.mp4 \x1b[0m`);
    ffmpeg(videoURL)
      .size(config.output.resolution)
      .aspect(config.output.aspect)
      .autoPad()
      .videoFilters({
        filter: "drawtext",
        options: {
          //fontfile: "",
          text: config.output.showAuthors ? author : "",
          fontsize: "(w/40)",
          fontcolor: "white",
          bordercolor: "black",
          borderw: 3,
          x: "(w-text_w-10)",
          y: "(h-text_h-10)",
          /* etc. */
        },
      })
      .addInput(audioURL)
      .output(`${config.dirs.tmp}${id}.mp4`)
      .on("end", () => {
        videos.push(`${id}.mp4`);
        handleLog(`\x1b[92m Encoded video: ${id}.mp4 \x1b[0m`);
        resolve();
      })
      .on("error", () => {
        //Resolving on this line, without writing to videos array makes it so we ignore clips without audio
        handleLog(`\x1b[91m Ignored video: ${id}.mp4 (audio not found) \x1b[0m`);
        resolve();
      })
      .run();
  });
};