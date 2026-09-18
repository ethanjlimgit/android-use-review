import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'droiduse-blog-attachments'
const BLOG_ATTACHMENTS_PREFIX = 'blog/attachments/'

export interface UploadFileOptions {
  file: Buffer | Uint8Array
  fileName: string
  contentType?: string
  folder?: string
}

export interface S3FileInfo {
  key: string
  url: string
  signedUrl?: string
}

/**
 * Upload a file to S3
 */
export async function uploadFileToS3(options: UploadFileOptions): Promise<S3FileInfo> {
  const { file, fileName, contentType = 'application/octet-stream', folder } = options
  
  // Generate a unique key for the file
  const timestamp = Date.now()
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  const key = folder 
    ? `${BLOG_ATTACHMENTS_PREFIX}${folder}/${timestamp}-${sanitizedFileName}`
    : `${BLOG_ATTACHMENTS_PREFIX}${timestamp}-${sanitizedFileName}`

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: 'public-read', // Make files publicly accessible
  })

  await s3Client.send(command)

  // Construct public URL
  const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`

  return {
    key,
    url,
  }
}

/**
 * Get a signed URL for a file (useful for private files)
 */
export async function getSignedFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * Delete a file from S3
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Extract S3 key from URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Handle both s3.amazonaws.com and bucket.s3.region.amazonaws.com formats
    if (urlObj.hostname.includes('s3') || urlObj.hostname.includes('amazonaws.com')) {
      // Remove leading slash
      return urlObj.pathname.substring(1)
    }
    return null
  } catch {
    return null
  }
}

