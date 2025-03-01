import { ImageUploader } from "@/components/image-uploader"

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-12 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Competitive Analysis Tool</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload photos of competitor promotions and sales incentives to generate insights and recommendations.
          </p>
        </div>
        <ImageUploader />
      </div>
    </main>
  )
}

