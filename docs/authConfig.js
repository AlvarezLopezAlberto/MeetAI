// docs/authConfig.js

// Obtenemos dinámicamente el origin (http://localhost:3000 en dev, o el dominio de Pages en prod)
const redirectUri = window.location.origin;

export const msalConfig = {
  auth: {
    clientId: "8060cd03-4874-4350-a41c-6c7c69178b82",      // <— reemplaza con tu clientId real
    authority: "https://login.microsoftonline.com/12345678-9abc-def0-1234-56789abcdef0",
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
