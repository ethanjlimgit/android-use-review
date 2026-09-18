"use client"

import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { Car, Heart, TrendingUp } from "lucide-react"
import { cn } from "@droiduse/shared-ui/utils"
import { Navigation, type ProductBrand } from "@/components/navigation"

const products: Record<string, { name: string; icon: typeof Car; color: string }> = {
  "ask-boris": { name: "Ask Boris", icon: Car, color: "text-emerald-400" },
  "ask-charlie": { name: "Ask Charlie", icon: Heart, color: "text-purple-400" },
  "androiduse": { name: "AndroidUse", icon: TrendingUp, color: "text-blue-400" },
}

export function ProductBranding() {
  const searchParams = useSearchParams()
  const productKey = searchParams.get("product")

  if (!productKey || !products[productKey]) return null

  const product = products[productKey]
  const Icon = product.icon

  return (
    <div className="flex items-center justify-center gap-2.5 mb-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md overflow-hidden">
        <Image
          src="/logo.png"
          alt={`${product.name} Logo`}
          width={32}
          height={32}
          className="object-contain"
          unoptimized
        />
      </div>
      <Icon className={cn("h-5 w-5", product.color)} />
      <span className={cn("text-lg font-semibold", product.color)}>
        {product.name}
      </span>
    </div>
  )
}

export function AuthNavigation() {
  const searchParams = useSearchParams()
  const productKey = searchParams.get("product") as ProductBrand | null
  const validProducts: ProductBrand[] = ["ask-boris", "ask-charlie", "androiduse"]
  const product = productKey && validProducts.includes(productKey) ? productKey : undefined

  return <Navigation product={product} />
}
