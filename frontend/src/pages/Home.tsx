import { Button } from '@/components/ui/button'
import { AddLinkDialog } from '@/components/add-link-dialog'
import { EditLinkDialog } from '@/components/edit-link-dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import Logo from '@/components/logo'
import { useAuth } from '@/lib/auth-context'
import {
  deleteLinkRequest,
  getApiErrorMessage,
  getLinksRequest,
  getShortUrl,
  normalizeClicks,
  type UserLink,
} from '@/lib/api'
import { copyText } from '@/lib/clipboard'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Link2, MousePointerClick, Plus, Trash2 } from 'lucide-react'

function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [links, setLinks] = useState<UserLink[]>([])
  const [isLoadingLinks, setIsLoadingLinks] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const copiedResetRef = useRef<number | null>(null)
  const deletingRef = useRef(false)

  useEffect(() => {
    document.title = 'Dashboard · ShortIt'
    return () => {
      document.title = 'ShortIt'
    }
  }, [])

  const loadLinks = useCallback(async (quiet = false) => {
    if (!quiet) {
      setIsLoadingLinks(true)
    }

    try {
      const response = await getLinksRequest()
      setLinks(response.links)
      setLoadError(null)
      if (!quiet) {
        setActionError(null)
      }
    } catch (loadErrorValue) {
      const message = getApiErrorMessage(loadErrorValue)
      if (quiet) {
        return
      }
      setLoadError(message)
    } finally {
      setIsLoadingLinks(false)
    }
  }, [])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  useEffect(() => {
    const onFocus = () => {
      void loadLinks(true)
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (copiedResetRef.current !== null) {
        window.clearTimeout(copiedResetRef.current)
      }
    }
  }, [loadLinks])

  const totals = useMemo(() => {
    const totalClicks = links.reduce((sum, link) => sum + normalizeClicks(link.clicks), 0)
    return {
      links: links.length,
      clicks: totalClicks,
    }
  }, [links])

  const handleCopy = async (shortUrl: string, slug: string) => {
    const copied = await copyText(shortUrl)
    if (!copied) {
      setActionError('Could not copy the short link.')
      return
    }

    setActionError(null)
    setCopiedSlug(slug)
    if (copiedResetRef.current !== null) {
      window.clearTimeout(copiedResetRef.current)
    }
    copiedResetRef.current = window.setTimeout(() => {
      setCopiedSlug((current) => (current === slug ? null : current))
    }, 2000)
  }

  const addLinkTrigger = (
    <Button type="button">
      <Plus className="size-4" aria-hidden="true" />
      Add Link
    </Button>
  )

  return (
    <div className='min-h-svh w-full p-4 sm:p-6'>
      <div className="mx-auto w-full max-w-3xl">

        <div className='flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-center gap-3'>
            <Logo size='xs' />
            <div className='min-w-0'>
              <h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
              <p className='truncate text-sm text-muted-foreground'>{user?.email}</p>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <ThemeToggle />
            <AddLinkDialog
              trigger={addLinkTrigger}
              onCreated={(newLink) => {
                setActionError(null)
                setLinks((prev) => [newLink, ...prev.filter((existingLink) => existingLink.id !== newLink.id)])
              }}
            />
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              Logout
            </Button>
          </div>
        </div>

        {!isLoadingLinks && !loadError ? (
          <div className='mt-8 grid grid-cols-2 gap-3'>
            <Card size='sm'>
              <CardHeader>
                <CardDescription className='flex items-center gap-1.5'>
                  <Link2 className='size-3.5' aria-hidden='true' />
                  Total links
                </CardDescription>
                <CardTitle className='text-2xl tabular-nums tracking-tight sm:text-3xl'>{totals.links}</CardTitle>
              </CardHeader>
            </Card>
            <Card size='sm'>
              <CardHeader>
                <CardDescription className='flex items-center gap-1.5'>
                  <MousePointerClick className='size-3.5' aria-hidden='true' />
                  Total clicks
                </CardDescription>
                <CardTitle className='text-2xl tabular-nums tracking-tight sm:text-3xl'>{totals.clicks}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : null}

      <div className="mt-8 flex flex-col gap-4 sm:mt-10">
          <h2 className='text-xl font-semibold tracking-tight'>Your Links</h2>

          {isLoadingLinks ? <p className='text-sm text-muted-foreground' role='status'>Loading links...</p> : null}

          {loadError ? (
            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-sm text-destructive' role='alert'>{loadError}</p>
              <Button type='button' variant='outline' size='sm' onClick={() => void loadLinks()}>
                Retry
              </Button>
            </div>
          ) : null}

          {actionError ? <p className='text-sm text-destructive' role='alert'>{actionError}</p> : null}

          {!isLoadingLinks && !loadError && links.length === 0 ? (
            <Card className='border-dashed bg-muted/30'>
              <CardHeader>
                <CardTitle className='text-base'>No links yet. Create your first short link.</CardTitle>
                <CardDescription>
                  Paste a destination URL to generate a short link you can share and track.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddLinkDialog
                  trigger={
                    <Button type="button">
                      <Plus className="size-4" aria-hidden="true" />
                      Create your first link
                    </Button>
                  }
                  onCreated={(newLink) => {
                    setActionError(null)
                    setLinks((prev) => [newLink, ...prev.filter((existingLink) => existingLink.id !== newLink.id)])
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          {!isLoadingLinks
            ? links.map((link) => {
                const shortUrl = getShortUrl(link.slug)
                const clicks = normalizeClicks(link.clicks)

                return (
                  <Card key={link.id} className='transition-colors duration-200 hover:bg-muted/30'>
                    <CardHeader>
                      <CardAction>
                        <div className='flex flex-wrap items-center justify-end gap-2'>
                          <EditLinkDialog
                            link={link}
                            trigger={<Button type='button' variant='outline' size='sm'>Edit URL</Button>}
                            onUpdated={(updatedLink) => {
                              setActionError(null)
                              setLinks((prev) =>
                                prev.map((existingLink) =>
                                  existingLink.id === updatedLink.id ? updatedLink : existingLink
                                )
                              )
                            }}
                          />
                          <Button
                            type='button'
                            variant='outline'
                            size='icon-sm'
                            disabled={deletingSlug === link.slug}
                            aria-label={`Delete /${link.slug}`}
                            onClick={async () => {
                              if (deletingRef.current) {
                                return
                              }

                              const shouldDelete = window.confirm(`Delete /${link.slug}?`)
                              if (!shouldDelete) {
                                return
                              }

                              deletingRef.current = true
                              setActionError(null)
                              setDeletingSlug(link.slug)

                              try {
                                await deleteLinkRequest(link.slug)
                                setLinks((prev) => prev.filter((existingLink) => existingLink.id !== link.id))
                              } catch (deleteError) {
                                setActionError(getApiErrorMessage(deleteError))
                              } finally {
                                deletingRef.current = false
                                setDeletingSlug(null)
                              }
                            }}
                          >
                            <Trash2 className='size-4' />
                            <span className='sr-only'>Delete link</span>
                          </Button>
                        </div>
                      </CardAction>
                      <CardTitle className='min-w-0 pr-2 text-sm break-all'>/{link.slug}</CardTitle>
                      <CardDescription className='min-w-0 break-all'>{link.url}</CardDescription>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                      <a
                        href={shortUrl}
                        target='_blank'
                        rel='noreferrer'
                        className='min-w-0 break-all text-sm font-medium text-primary underline underline-offset-4'
                      >
                        {shortUrl}
                      </a>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant='secondary'>
                          {clicks} {clicks === 1 ? 'click' : 'clicks'}
                        </Badge>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => void handleCopy(shortUrl, link.slug)}
                        >
                          <Copy className='size-3.5' />
                          {copiedSlug === link.slug ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            : null}
      </div>
      </div>
    </div>
  )
}

export default Home
