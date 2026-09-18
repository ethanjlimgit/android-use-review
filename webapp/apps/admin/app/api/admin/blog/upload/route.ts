import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { uploadFileToS3 } from "@droiduse/shared-lib/server"

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const folder = formData.get("folder") as string | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to S3
    const result = await uploadFileToS3({
      file: buffer,
      fileName: file.name,
      contentType: file.type,
      folder: folder || undefined,
    })

    return NextResponse.json({
      url: result.url,
      key: result.key,
    })
  } catch (error) {
    console.error("Error uploading file:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}

