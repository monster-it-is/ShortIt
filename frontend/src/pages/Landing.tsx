import { Button } from '@/components/ui/button'
import { AuthDialog } from '@/components/auth'
import { useAuth } from '@/lib/auth-context'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LandingNav from '@/components/nav'
import { BarChart3, Link2, MousePointerClick, ShieldCheck, WandSparkles } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function Landing() {
  const { isAuthenticated, isLoading } = useAuth()
  const [openAuth, setOpenAuth] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    document.title = 'ShortIt — Short links that stay organized'
  }, [])

  const handleGetStarted = () => {
    if (isLoading) {
      return
    }

    if (isAuthenticated) {
      navigate('/home')
      return
    }
    setOpenAuth(true)
  }

  const features = [
  {
    title: 'Simple Link Management',
    description: 'Create, customize, edit, and manage shortened URLs from one dashboard.',
    icon: Link2,
  },
  {
    title: 'Click Analytics',
    description: 'Track total clicks and monitor link activity using real stored data.',
    icon: BarChart3,
  },
  {
    title: 'Custom Short Links',
    description: 'Create meaningful custom slugs or automatically generate secure URLs.',
    icon: WandSparkles,
  },
  {
    title: 'Account-Based Management',
    description: 'Keep personal links organized under authenticated user accounts.',
    icon: ShieldCheck,
  },
  {
    title: 'Reliable URL Redirection',
    description: 'Resolve shortened URLs through the existing backend with click counting.',
    icon: MousePointerClick,
  },
]

  return (
    <>
    <LandingNav onStart={handleGetStarted} disabled={isLoading}/>
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center gap-5 overflow-hidden px-4 pb-16 pt-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklch,var(--foreground)_8%,transparent),transparent)]"
      />
      <span className='relative rounded-full border bg-card px-3 py-1 text-sm text-muted-foreground'>Introducing ShortIt</span>
      <h1 className='relative mb-2 max-w-3xl text-center text-4xl font-semibold tracking-tight sm:text-6xl'>Make your links look smart.</h1>
      <p className='relative max-w-lg text-center text-base leading-relaxed text-muted-foreground sm:text-lg'>Turn long, messy URLs into sleek, shareable links. Create, manage, and track them from one dashboard.</p>
      <div className="relative flex flex-wrap items-center justify-center gap-3">
      <Button
      type="button"
      size={"lg"}
      onClick={handleGetStarted}
      disabled={isLoading}
      >
        {isLoading ? "Checking session..." : "Get Started"}
      </Button>
      <Button
      asChild
      size={"lg"}
      variant={"outline"}>
        <a href="#why-shortit">
          Learn More
        </a>
      </Button>
      </div>
      <AuthDialog
        open={openAuth}
        onOpenChange={setOpenAuth}
        onSuccess={() => navigate('/home')}
      />
    </div>
    <section id="why-shortit" className='flex w-full scroll-mt-28 flex-col items-center justify-center gap-10 px-4 py-16 sm:py-24'>
      <div className='max-w-2xl text-center'>
        <h2 className='text-3xl font-semibold tracking-tight sm:text-5xl'>Why ShortIt?</h2>
        <p className='mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base'>The capabilities this app already ships — not a wishlist.</p>
      </div>

      <div className='grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {features.map((feature) => {
          const Icon = feature.icon

          return (
            <Card key={feature.title} className='h-full transition-colors duration-200 hover:bg-muted/40'>
              <CardHeader>
                <div className='mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-foreground ring-1 ring-border'>
                  <Icon className='h-4 w-4' aria-hidden='true' />
                </div>
                <CardTitle className="text-xl font-semibold">
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                </CardTitle>
                <CardDescription className='leading-relaxed'>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </section>
    <footer className='border-t px-4 py-8 text-center text-sm text-muted-foreground'>
      <p>ShortIt — short links with click tracking.</p>
    </footer>
    </>
  )
}

export default Landing
