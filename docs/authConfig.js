// authConfig.js

export const msalConfig = {
  auth: {
    clientId: "8060cd03-4874-4350-a41c-6c7c69178b82", //Application (client) ID
    authority: "https://login.microsoftonline.com/common",
    redirectUri: "https://AlvarezLopezAlberto.github.io/MeetAI/"
  },
  cache: {
    cacheLocation: "localStorage",       // guarda tokens en localStorage
    storeAuthStateInCookie: false,
  }
};

// Scopes que pediremos para Graph
export const loginRequest = {
  scopes: ["Files.ReadWrite.All", "User.Read"]
};
