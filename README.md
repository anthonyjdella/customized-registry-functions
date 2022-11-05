# Customtized Registry Functions

🖼️ This is a slightly tweaked version of the [JSON Registry](https://github.com/jsonresume/registry-functions). That project is using their own Firebase project and a specific JSON schema. Since I customized my own schema, I want to be able to use this with a registry so that my schema is validated.

## How's it Work? 
* This is a website hosted on Firebase and tied to my custom subdomain [resume.anthonydellavecchia.com](https://resume.anthonydellavecchia.com). 
* It makes use of `Firebase Functions` to trigger HTTPS requests.
  * For example, there are methods to get a list of all possible themes, all users, get `resume.json` from GitHub gists, and more.
* `Firebase Firestore Database` and `Realtime Database` are used to store JSON resumes of GitHub users. Once the user data is fetched, it is stored in these databases.

## Contents

* `firebase.json` holds configuration of Firebase functionality. It sets up `Firebase functions, database, and hosting`.
* `.firebaserc` ties this project to a project set up in Firebase.
* `database.rules.json` holds Firebase database rules.
* `firestore.rules` holds Firebase database configuration.
* `public/index.html` is the home page HTML for this site.
* `functions/package.json` holds dependencies, including my custom built themes.
* `functions/index.js` holds the core code for the Firebase registry functions. It looks for GitHub users Gists named `resume.json` then stores that data in Firebase. Then validates the JSON and applies a theme to it.

## Custom Themes

I've added the following custom themes:
* "@anthonyjdella/jsonresume-theme-anthonyjdella-actual": "^1.0.6",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-caffeine": "^1.0.4",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-elegant": "^1.0.9",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-github": "^1.0.3",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-rocketspacer": "^1.0.0",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-simple-red": "^1.0.0",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-spartan": "^1.0.0",
* "@anthonyjdella/jsonresume-theme-anthonyjdella-stackoverflow": "^1.0.0"

More will be added in the future. There are also many existing themes which can be viewed in `functions/package.json`.

<details>
  <summary>Click to expand README.md of the source repository!</summary>

# Registry Functions 

This repository is responsible for our free community hosting. 

It currently runs on Firebase. 

</details>
