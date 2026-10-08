import Logo from '@/components/logo'
import { classifyResolveFailure, resolveShortLinkRequest } from '@/lib/api'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

type ResolveStatus = 'loading' | 'not-found' | 'network' | 'invalid' | 'server'

function ResolveMessage({ children }: { children: string }) {
  return (
    <div className='flex h-svh w-full items-center justify-center px-4 text-center'>
      <div className='max-w-md rounded-xl border bg-card px-8 py-10 text-card-foreground shadow-sm'>
        <p role='alert'>{children}</p>
      </div>
    </div>
  )
}

function SlugResolver({ slug }: { slug: string }) {
  const [status, setStatus] = useState<ResolveStatus>('loading')
  const inFlightSlugRef = useRef<string | null>(null)

  useEffect(() => {
    // StrictMode replays this effect on the same navigation while preserving refs.
    // Skip a second request for the same slug so one visit is not counted twice.
    // Do not abort on cleanup: that would cancel the only in-flight request.
    if (inFlightSlugRef.current === slug) {
      return
    }

    inFlightSlugRef.current = slug

    const resolveAndRedirect = async () => {
      try {
        const response = await resolveShortLinkRequest(slug)
        if (inFlightSlugRef.current !== slug) {
          return
        }

        const destination = response.url?.trim()
        if (!destination) {
          setStatus('invalid')
          return
        }

        window.location.replace(destination)
      } catch (error) {
        if (inFlightSlugRef.current !== slug) {
          return
        }

        setStatus(classifyResolveFailure(error))
      }
    }

    void resolveAndRedirect()
  }, [slug])

  if (status === 'loading') {
    return (
      <div className='flex h-svh w-full items-center justify-center px-4'>
        <div className="flex flex-col items-center justify-center gap-8 rounded-xl border bg-card px-10 py-10 text-card-foreground shadow-sm">
          <Logo size='lg'/>
          <p role='status'>Powered by ShortIt</p>
        </div>
      </div>
    )
  }

  const message =
    status === 'not-found'
      ? 'Link not found'
      : status === 'network'
        ? 'Unable to reach the server. After idle time the API may take about a minute to wake. Wait and try again.'
        : status === 'invalid'
          ? 'This short link has an invalid destination.'
          : 'Failed to resolve link'

  return <ResolveMessage>{message}</ResolveMessage>
}

function LinkPage() {
  const { slug } = useParams()

  if (!slug) {
    return <ResolveMessage>Link not found</ResolveMessage>
  }

  return <SlugResolver key={slug} slug={slug} />
}

export default LinkPage
