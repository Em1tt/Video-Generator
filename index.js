const { subreddit, filter } = require("./config.json");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const fs = require("fs");
const glob = require("glob");
const { exec } = require("child_process");

const ffmpeg = require("fluent-ffmpeg");

const videos = [];
let after = null;

(async () => {
  while (videos.length < 50) {
    await fetch(
      `https://www.reddit.com/r/escapefromtarkov/top/.json?t=week${
        after ? `&after=${after}` : ``
      }`
    ).then(async (res) => {
      const result = await res.json();
      after = result.data.after;
      let posts = result.data.children.filter((post) => {
        if (post.data.is_video && post.data.is_reddit_media_domain) return true;
      });
      for (const post of posts) {
        const id = post.data?.url_overridden_by_dest?.split(".it/")[1];
        const videoURL = post.data.media?.reddit_video.fallback_url;
        const audioURL = `https://v.redd.it/${id}/DASH_audio.mp4?source=fallback`;
        await processVideoSync(videoURL, audioURL, id);
      }
    });
  }

  let cmd = `ffmpeg -i "concat:${videos.join("|")}" -c:a copy -c:v copy merged_video.avi`
    exec(cmd, function(err, stdout, stderr) {
  if(err) console.log(err)
  else console.log("Done!")
})

})();

async function processVideoSync(videoURL, audioURL, id) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(`./tmp/output/${id}.avi`)) {
      videos.push(`./tmp/output/${id}.avi`);
      return resolve();
    };
    const proc = new ffmpeg();
    proc
      .addInput(videoURL).size('1920x?').autoPad()
      .addInput(audioURL)
      .output(`./tmp/output/${id}.avi`)
      .on("end", () => {
        videos.push(`./tmp/output/${id}.avi`);
        console.log(`FINISHED VIDEO #${videos.length}`);
        resolve();
      })
      .on("error", () => {
        resolve();
      })
      .run();
  });
}
