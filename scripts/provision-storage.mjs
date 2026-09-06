/**
 * Provisions Firebase Storage for the project.
 *
 * The app has always called `uploadBytes` against
 * `promanaged-it.firebasestorage.app`, but the project has no storage bucket at
 * all — Storage was never enabled — so every photo upload in the product has
 * failed since it was written.
 *
 * Enabling it is two steps: create the GCS bucket, then register it with the
 * Firebase Storage service so the client SDK and security rules apply to it.
 * A raw GCS bucket the client SDK cannot see would be no use.
 *
 *   node scripts/provision-storage.mjs            # report only
 *   node scripts/provision-storage.mjs --apply
 */
import { Storage } from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';
import fs from 'node:fs';
import { APPLY, PROJECT_ID, heading, plan } from './admin.mjs';

const appletConfig = JSON.parse(fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf-8'));
const BUCKET = appletConfig.storageBucket;

/** Matches the multi-region Firestore already uses, keeping data co-located. */
const LOCATION = 'US';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
const storage = new Storage({ projectId: PROJECT_ID, credentials });

heading(`Firebase Storage for ${PROJECT_ID}`);

const [buckets] = await storage.getBuckets();
console.log(`  existing buckets: ${buckets.length ? buckets.map(b => b.name).join(', ') : '(none)'}`);

const bucket = storage.bucket(BUCKET);
const [exists] = await bucket.exists();

if (!exists) {
  plan(`create bucket ${BUCKET} in ${LOCATION}`);
  if (APPLY) {
    await storage.createBucket(BUCKET, {
      location: LOCATION,
      // Uniform access keeps permissions in Storage rules rather than per-object
      // ACLs, which is what Firebase Storage expects.
      iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
    });
    console.log(`  created ${BUCKET}`);
  }
} else {
  console.log(`  bucket ${BUCKET} already exists`);
}

// --- Register the bucket with Firebase Storage ------------------------------
// Without this the bucket is plain GCS: the web SDK cannot reach it and the
// rules in storage.rules would never be consulted.
heading('Registering the bucket with Firebase Storage');

const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});
const client = await auth.getClient();

const listUrl = `https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_ID}/buckets`;
let alreadyLinked = false;
try {
  const { data } = await client.request({ url: listUrl });
  const names = (data.buckets ?? []).map(b => b.name.split('/').pop());
  console.log(`  linked to Firebase: ${names.length ? names.join(', ') : '(none)'}`);
  alreadyLinked = names.includes(BUCKET);
} catch (error) {
  console.log(`  could not list linked buckets: ${error.message.slice(0, 160)}`);
}

if (!alreadyLinked) {
  plan(`link ${BUCKET} to Firebase Storage`);
  if (APPLY) {
    try {
      await client.request({
        url: `https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_ID}/buckets/${BUCKET}:addFirebase`,
        method: 'POST',
        data: {},
      });
      console.log('  linked');
    } catch (error) {
      const detail = error.response?.data?.error?.message ?? error.message;
      console.error(`\n  Could not link the bucket: ${detail}\n`);
      console.error('  Enable Storage once in the Firebase Console (Build -> Storage ->');
      console.error('  Get started), then re-run this script. Everything else is in place.\n');
      process.exit(1);
    }
  }
} else {
  console.log(`  ${BUCKET} is already registered with Firebase Storage`);
}

console.log(
  APPLY
    ? '\nDone. Deploy the rules next:  npx firebase deploy --only storage\n'
    : '\nReport only. Re-run with --apply to provision.\n'
);
process.exit(0);
