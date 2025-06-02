// docs/authConfig.js

// Detectamos dinámicamente el origen (por ejemplo "http://localhost:3000" o "https://TU_USUARIO.github.io")
const origin = window.location.origin;

// Construimos el redirectUri:
// - Si estamos en GitHub Pages (hostname contiene "github.io"), añadimos "/MeetAI"
// - En local (localhost), podemos usar origin directamente
let redirectUri;
if (origin.includes("github.io")) {
  redirectUri = origin + "/MeetAI";
} else {
  // en localhost:3000
  redirectUri = origin;
}

export const msalConfig = {
  auth: {
    clientId: "8060cd03-4874-4350-a41c-6c7c69178b82", // tu Application (client) ID de Azure AD
    authority: "https://login.microsoftonline.com/fd12fc4f-bbd2-4d9a-bd11-63a4b103d39f", 
    redirectUri: redirectUri
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  }
};

export const loginRequest = {
  scopes: ["Files.ReadWrite.All", "User.Read"]
};
