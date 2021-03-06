const functions = require("firebase-functions");
const _ = require("lodash");
const axios = require("axios");
const express = require("express");
const cors = require("cors");
const resumeSchema = require("anthonyjdella-resume-schema");
const fs = require("fs");
const app = express();
app.use(cors({ origin: true }));
// Import Admin SDK
var admin = require("firebase-admin");
require('dotenv').config;

const packages = JSON.parse(fs.readFileSync(__dirname + "/package.json"))
  .dependencies;

const themes = _.filter(_.keys(packages), p => {
  return p.indexOf("theme") !== -1;
});

console.log("NODE_ENV: " + process.env.NODE_ENV);
admin.initializeApp(functions.config().firebase);
// if (process.env.NODE_ENV === "production") {
//   admin.initializeApp(functions.config().firebase);
// } else {
//   var serviceAccount = require("../creds.json");
//   admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://jsonresume-registry-b00b5-default-rtdb.firebaseio.com"
//   });
// }

var db = admin.database();
const dbs = admin.firestore();

const makeTemplate = message => {
  const template = fs.readFileSync(__dirname + "/template.html", "utf8");
  return template.replace("{MESSAGE}", message);
};
const getTheme = theme => {
  try {
    return require(__dirname + "/node_modules/jsonresume-theme-" + theme);
  } catch (e) {
    return {
      e: e.toString(),
      error:
        "Theme is not supported please visit -> https://github.com/jsonresume/registry-functions/issues/7"
    };
  }
};

const getCustomTheme = custom => {
  try {
    return require(__dirname + "/node_modules/@anthonyjdella/jsonresume-theme-anthonyjdella-" + custom);
  } catch (e) {
    return {
      e: e.toString(),
      error:
        "Custom Theme is not supported. Create a custom theme and publish it as an NPM package with the name @anthonyjdella/jsonresume-theme-anthonyjdella-{name-of-theme}"
    };
  }
};

app.get("/themes", (req, res) => {
  res.send(themes);
});
app.get("/theme/:theme", (req, res) => {
  const resumeJson = JSON.parse(fs.readFileSync(__dirname + "/resume.json"));
  const theme = req.params.theme.toLowerCase();
  const themeRenderer = getTheme(theme);
  if (themeRenderer.error) {
    return res.send(themeRenderer.error + " - " + themeRenderer.e);
  }
  const resumeHTML = themeRenderer.render(resumeJson, {});
  res.send(resumeHTML);
});
app.get("/customTheme/:customTheme", (req, res) => {
  const resumeJson = JSON.parse(fs.readFileSync(__dirname + "/resume.json"));
  const customTheme = req.params.customTheme.toLowerCase();
  const themeRenderer = getCustomTheme(customTheme);
  if (themeRenderer.error) {
    return res.send(themeRenderer.error + " - " + themeRenderer.e);
  }
  const resumeHTML = themeRenderer.render(resumeJson, {});
  res.send(resumeHTML);
});
app.get("/", (req, res) => {
  res.send("Visit jsonresume.org to learn more");
});
app.get("/all", (req, res) => {
  const resumesRef = dbs.collection("resumes");
  resumesRef
    .get()
    .then(snapshot => {
      const resumes = [];
      snapshot.forEach(doc => {
        resumes.push(doc.id);
        console.log(doc.id, "=>", doc.data());
      });
      return res.send(resumes);
    })
    .catch(err => {
      console.log("Error getting documents", err);
      return [];
    });
});
app.post("/theme/:theme", (req, res) => {
  console.log("Rendering theme");
  const resumeJson = req.body.resume;
  var start = new Date();
  const theme = req.params.theme.toLowerCase();
  const themeRenderer = getTheme(theme);
  var end = new Date() - start;
  console.info("Execution time getTheme: %dms", end);
  if (themeRenderer.error) {
    return res.send(themeRenderer.error + " - " + themeRenderer.e);
  }
  start = new Date();
  const resumeHTML = themeRenderer.render(resumeJson, {});
  end = new Date() - start;
  console.info("Execution time render: %dms", end);
  console.log("finished");
  res.send(resumeHTML);
});
app.get("/:username", async (req, res) => {
  const username = req.params.username;
  if (
    [
      "favicon.ico",
      "competition",
      "stats",
      "apple-touch-icon.png",
      "apple-touch-icon-precomposed.png",
      "robots.txt"
    ].indexOf(username) !== -1
  ) {
    return res.send(null);
  }
  var ref = db.ref();
  var usersRef = ref.child("gists/" + username);
  usersRef.on("value", async dataSnapshot => {
    console.log("=======");
    console.log(dataSnapshot.val());
    let gistId;
    if (!dataSnapshot.val() || !dataSnapshot.val().gistId) {
      console.log("Fetching gistId");
      console.log(`https://api.github.com/users/${req.params.username}/gists`);
      let gistData = {};
      try {
        gistData = await axios.get(
          `https://api.github.com/users/${req.params.username}/gists`
        );
      } catch (e) {
        return res.send(makeTemplate("This is not a valid Github username"));
      }
      if (!gistData.data) {
        return res.send(makeTemplate("This is not a valid Github username"));
      }
      const resumeUrl = _.find(gistData.data, f => {
        return f.files["resume.json"];
      });
      if (!resumeUrl) {
        return res.send(makeTemplate("You have no gists named resume.json"));
      }
      gistId = resumeUrl.id;
    } else {
      console.log("Using cached gistId");
      gistId = dataSnapshot.val().gistId;
    }

    usersRef.set({ gistId: gistId }, () => {});
    const fullResumeGistUrl =
      `https://gist.githubusercontent.com/${username}/${gistId}/raw?cachebust=` +
      new Date().getTime();
    console.log(fullResumeGistUrl);
    let resumeRes = {};
    try {
      resumeRes = await axios({
        method: "GET",
        headers: { "content-type": "application/json" },
        url: fullResumeGistUrl
      });
    } catch (e) {
      // If gist url is invalid, flush the gistid in cache
      usersRef.set(null, () => {});
      return res.send(
        makeTemplate("The gist couldnt load, we flushed the cache so try again")
      );
    }

    if (!resumeRes.data) {
      return res.send(makeTemplate("Something went wrong fetching resume"));
    }
    resumeSchema.validate(resumeRes.data, async (err, report) => {
      console.log("validation finished");
      if (err) {
        console.log(err);
        return res.send(
          makeTemplate("Resume json invalid - " + JSON.stringify(err) + " - Please visit https://github.com/jsonresume/registry-functions/issues/27")
        );
      }
      const resumesRef = dbs.collection("resumes");
      resumesRef.doc(username).set(resumeRes.data);

      if (req.query.theme) {
        let theme =
        req.query.theme ||
        (resumeRes.data.meta && resumeRes.data.meta.theme) ||
        "flat";
        theme = theme.toLowerCase();
        const themeRenderer = getTheme(theme);
        if (themeRenderer.error) {
          return res.send(themeRenderer.error + " - " + themeRenderer.e);
        }
        const resumeHTML = themeRenderer.render(resumeRes.data, {});
        // if (!resumeHTMLRes.data) {
        //   res.send("There was an error generatoring your resume");
        // }
        res.send(resumeHTML);
      } 
      else if (req.query.customTheme) {
        let custom = req.query.customTheme || "github";
        custom = custom.toLowerCase();
        console.log("using custom theme: " + custom);
        const customThemeRenderer = getCustomTheme(custom);
        if (customThemeRenderer.error) {
          return res.send(customThemeRenderer.error + " - " + customThemeRenderer.e);
        }
        console.log("about to render resumeRes.data: ");
        console.log(resumeRes.data);
        const customResumeHTML = customThemeRenderer.render(resumeRes.data, {});
        console.log("customResumeHTML: ");
        console.log(customResumeHTML);
        res.send(customResumeHTML);
      }
      else {
        let fallback = (resumeRes.data.meta && resumeRes.data.meta.theme) || "macchiato"
        fallback = fallback.toLowerCase();
        const fallbackThemeRenderer = getCustomTheme(custom);
        if (fallbackThemeRenderer.error) {
          return res.send(fallbackThemeRenderer.error + " - " + fallbackThemeRenderer.e);
        }
        const fallbackResumeHTML = fallbackThemeRenderer.render(resumeRes.data, {});
        res.send(fallbackResumeHTML);
      }

    });
  });
});
app.listen(3000);
exports.registry = functions.https.onRequest(app);
