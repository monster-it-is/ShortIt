import { cn } from '@/lib/utils'

function Logo({size = "sm"}: {size?: "sm" | "lg" | "xs"}) {
  return (
    <div className={cn(
        size == "sm" && "w-10",
        size == "lg" && "w-15",
        size == "xs" && "w-8"
    )}>
          <img src="/logo.svg" alt="ShortIt" />
    </div>
  )
}

export default Logo
