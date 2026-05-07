const fs = require('fs');

const lines = fs.readFileSync('auth.js', 'utf8').split('\n');

let startIdx = lines.findIndex(line => line.includes("const loginForm = document.getElementById('loginForm');"));
let endIdx = lines.findIndex(line => line.includes("// Fetch profile from backend"));

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find start or end index");
    process.exit(1);
}

// Expand startIdx to include the comments before it
while(startIdx > 0 && lines[startIdx - 1].trim().startsWith('//')) {
    startIdx--;
}

const uiLines = lines.slice(startIdx, endIdx);

const imports = `import './style.css';
import { initLanguage } from './language.js';
import { countries } from './utils/countries.ts';
import { 
    loginUser, registerUser, sendResetCode, resetPasswordWithCode,
    saveCredentials, loadCredentials, clearCredentials,
    isLoggedIn, isAdmin 
} from './auth.js';

const API_URL = '/api';

`;

fs.writeFileSync('auth-ui.ts', imports + uiLines.join('\n'));

const newAuthLines = [
    ...lines.slice(0, startIdx),
    ...lines.slice(endIdx)
];

let authContent = newAuthLines.join('\n');
authContent = authContent.replace(
    /export\s*\{\s*isLoggedIn, logout, getCurrentUser, isAdmin,\s*getAllUsers, deleteUser, toggleAdminStatus,\s*updateUser, getAuthToken, fetchUserProfile\s*\};/m,
    `export { 
    isLoggedIn, logout, getCurrentUser, isAdmin, 
    getAllUsers, deleteUser, toggleAdminStatus, 
    updateUser, getAuthToken, fetchUserProfile,
    loginUser, registerUser, sendResetCode, resetPasswordWithCode,
    saveCredentials, loadCredentials, clearCredentials
};`
);

fs.writeFileSync('auth.js', authContent);

const authHtml = fs.readFileSync('auth.html', 'utf8');
fs.writeFileSync('auth.html', authHtml.replace('<script type="module" src="./auth.js"></script>', '<script type="module" src="./auth-ui.ts"></script>'));

console.log("Successfully extracted auth-ui.ts, updated auth.js and auth.html");
