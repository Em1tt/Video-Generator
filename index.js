const {
  subreddit,
  filter,
  outputDir,
  tmpDir,
  amount,
  resolution,
  aspect,
  showAuthors,
  cleanCache,
  silent
} = require("./config.json");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const ffmpeg = require("fluent-ffmpeg");
const crypto = require("crypto");
const videos = [];
let after = null;
(async () => {
  while (videos.length < amount) {
    await fetch(
      `https://www.reddit.com/r/${subreddit}/${filter}/.json?t=week${
        after ? `&after=${after}` : ``
      }`
    ).then(async (res) => {
      const result = await res.json();
      after = result.data.after;
      let posts = result.data.children.filter((post) => {
        if (post.data.is_video && post.data.is_reddit_media_domain) return true;
      });
      for (const post of posts) {
        if (videos.length > amount) break;
        const id = post.data?.url_overridden_by_dest?.split(".it/")[1];
        const videoURL = post.data.media?.reddit_video.fallback_url;
        const audioURL = `https://v.redd.it/${id}/DASH_audio.mp4?source=fallback`;
        silent ? 0 : console.log(`STARTED VIDEO: ${id}.mp4`);
        const author = `u/${post.data.author}`;
        await processVideoSync(videoURL, audioURL, id, author);
      }
    });
  }
  await mergeVideoSync();
  if (cleanCache) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir);
    silent ? 0 : console.log("CLEANED TEMP FOLDER");
  }
  silent ? 0 : console.log("COMPLETED.");
})();

async function mergeVideoSync() {
  //Randomized due to FFMPEG asking for permission to overwrite - lazy fix ik
  const videoName = crypto.randomUUID();
  silent ? 0 : console.log(`STARTED COMPILATION: ${videoName}.mp4`);
  return new Promise((resolve, reject) => {
    fs.writeFile(
      `${tmpDir}list.txt`,
      videos
        .map((vid) => {
          return `file '${vid}'`;
        })
        .join("\n"),
      async (err) => {
        await exec(
          `ffmpeg -safe 0 -f concat -i ${tmpDir}list.txt -c copy ${outputDir}${videoName}.mp4`
        );
        silent ? 0 : console.log(`FINISHED COMPILATION: ${videoName}.mp4`);
        return resolve(videoName);
      }
    );
  });
}

async function processVideoSync(videoURL, audioURL, id, author) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(`${tmpDir}${id}.mp4`)) {
      videos.push(`${id}.mp4`);
      silent ? 0 : console.log(`IGNORED VIDEO: ${id}.mp4\n---------------------`);
      return resolve();
    }
    const proc = new ffmpeg();

    proc
      .addInput(videoURL)
      .size(resolution)
      .aspect(aspect)
      .autoPad()
      .videoFilters({
        filter: "drawtext",
        options: {
          //fontfile: "",
          text: showAuthors ? author : "",
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
      .output(`${tmpDir}${id}.mp4`)
      .on("end", () => {
        videos.push(`${id}.mp4`);
        silent ? 0 : console.log(`FINISHED VIDEO: ${id}.mp4\n---------------------`);
        resolve();
      })
      .on("error", () => {
        resolve();
      })
      .run();
  });
}
