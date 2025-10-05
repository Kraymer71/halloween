import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const endpoint = process.env.SPACES_ENDPOINT;
const bucket = process.env.SPACES_BUCKET;
const key = process.env.SPACES_KEY;
const secret = process.env.SPACES_SECRET;

function hmacSHA1(keyBuf: Buffer, str: string) {
  return crypto.createHmac('sha1', keyBuf).update(str).digest('base64');
}

// DigitalOcean Spaces v2 presign for PUT
export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();
    if (!filename || !contentType) return new Response('Bad request', { status: 400 });
    if (!endpoint || !bucket || !key || !secret) return new Response('Spaces not configured', { status: 500 });

    const objectKey = `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const baseUrl = `${endpoint.replace('https://','https://'+bucket+'.')}/${objectKey}`;

    const expires = Math.floor(Date.now()/1000) + 60;
    const stringToSign = `PUT\n\n${contentType}\n${expires}\n/${bucket}/${objectKey}`;
    const signature = encodeURIComponent(hmacSHA1(Buffer.from(secret), stringToSign));

    const signedUrl = `${baseUrl}?AWSAccessKeyId=${encodeURIComponent(key)}&Expires=${expires}&Signature=${signature}`;

    return NextResponse.json({ url: signedUrl, publicUrl: baseUrl });
  } catch (e:any) {
    return new Response(e?.message || 'Error', { status: 500 });
  }
}
