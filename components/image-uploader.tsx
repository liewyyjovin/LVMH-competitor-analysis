"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, X, Check, AlertCircle, Loader2, ImageIcon, Download, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { uploadImages } from "@/lib/actions"

type FileWithPreview = File & {
  preview: string
}

interface OcrProgressData {
  progress: number
  completed: number
  total: number
}

export function ImageUploader() {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [ocrProgress, setOcrProgress] = useState<OcrProgressData | null>(null)
  const [processingTime, setProcessingTime] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Timer effect for counting seconds while processing
  useEffect(() => {
    if (isUploading) {
      setElapsedSeconds(0)
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isUploading])

  // Effect to poll for OCR progress
  useEffect(() => {
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }

    if (sessionId && isUploading) {
      // Start polling for progress
      progressIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/ocr-progress?sessionId=${sessionId}`)
          const data = await response.json()
          
          if (response.ok) {
            setOcrProgress(data)
            
            // If OCR is complete (progress is 100%), we can stop polling
            if (data.progress === 100) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current)
                progressIntervalRef.current = null
              }
            }
          }
        } catch (err) {
          console.error("Error fetching OCR progress:", err)
        }
      }, 1000) // Poll every second
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [sessionId, isUploading])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null)

    // Check if any files are not images
    const nonImageFiles = acceptedFiles.filter((file) => !file.type.startsWith("image/"))

    if (nonImageFiles.length > 0) {
      setError("Only image files are allowed")
      return
    }

    // Add preview URLs to the files
    const filesWithPreviews = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      }),
    )

    setFiles((prev) => [...prev, ...filesWithPreviews])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
    },
  })

  const removeFile = (fileToRemove: FileWithPreview) => {
    setFiles(files.filter((file) => file !== fileToRemove))
    URL.revokeObjectURL(fileToRemove.preview)
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one image to upload")
      return
    }

    setIsUploading(true)
    setError(null)
    setOcrProgress(null)
    setProcessingTime(null)

    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append(`file-${index}`, file)
      })

      const result = await uploadImages(formData)
      
      if (!result.success && result.error) {
        setError(result.error)
        return
      }
      
      setUploadSuccess(true)
      setSessionId(result.sessionId)
      setAnalysisResult(result.analysisResult || result.extractedData || null)

      // Format the processing time if available
      if (result.processingTimeMs) {
        const seconds = Math.floor(result.processingTimeMs / 1000)
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        
        if (minutes > 0) {
          setProcessingTime(`${minutes}m ${remainingSeconds}s`)
        } else {
          setProcessingTime(`${remainingSeconds}s`)
        }
      }

      // Clean up preview URLs
      files.forEach((file) => URL.revokeObjectURL(file.preview))
      setFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload images")
    } finally {
      setIsUploading(false)
      setOcrProgress(null)
    }
  }

  const resetUpload = () => {
    setUploadSuccess(false)
    setSessionId(null)
    setAnalysisResult(null)
  }

  const handleDownload = () => {
    if (sessionId) {
      window.open(`/api/download/${sessionId}`, '_blank')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins > 0 ? `${mins}m ` : ''}${secs}s`
  }

  if (uploadSuccess) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Analysis Complete!</h3>
            <p className="text-gray-600 mb-6">
              Your images have been analyzed successfully. You can now download the report.
              {processingTime && (
                <span className="block mt-2 text-sm">
                  Total processing time: <span className="font-semibold">{processingTime}</span>
                </span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleDownload} className="flex items-center">
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
              <Button onClick={resetUpload} variant="outline">
                Upload More Images
              </Button>
            </div>
            
            {analysisResult && (
              <div className="mt-8 w-full">
                <h4 className="text-lg font-semibold mb-4 text-left">Analysis Preview:</h4>
                <div className="bg-gray-50 p-4 rounded-md border text-left overflow-auto max-h-96 whitespace-pre-wrap">
                  {analysisResult}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="w-full">
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50 hover:bg-gray-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Drag & drop images here</h3>
              <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
              <Button type="button" variant="outline" size="sm">
                Select Images
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Selected Images ({files.length})</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                files.forEach((file) => URL.revokeObjectURL(file.preview))
                setFiles([])
              }}
            >
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-md overflow-hidden border bg-gray-100">
                  <img
                    src={file.preview || "/placeholder.svg"}
                    alt={`Preview ${index + 1}`}
                    className="h-full w-full object-cover"
                    onLoad={() => {
                      // Revoke the data URI after the image is loaded to avoid memory leaks
                      // URL.revokeObjectURL(file.preview)
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-xs text-gray-500 truncate mt-1">{file.name}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={isUploading} className="min-w-[150px]">
              {isUploading ? (
                <>
                  {ocrProgress ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      OCR Processing: {ocrProgress.progress}% ({ocrProgress.completed}/{ocrProgress.total}) - {formatTime(elapsedSeconds)}
                    </>
                  ) : (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-pulse" />
                      Processing... {formatTime(elapsedSeconds)}
                    </>
                  )}
                </>
              ) : (
                "Analyze Images"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

