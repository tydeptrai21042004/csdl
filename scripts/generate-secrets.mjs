import {randomBytes} from 'node:crypto';
console.log('Paste these into Vercel Project → Settings → Environment Variables.');
console.log('Use a different password for any real service, and never commit these values.');
for (const key of ['ADMIN_PASSWORD','SESSION_SECRET','SETUP_TOKEN']) {
 console.log(`${key}=${randomBytes(32).toString('hex')}`);
}
