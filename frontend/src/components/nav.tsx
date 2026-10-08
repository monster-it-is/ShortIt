import Logo from './logo'
import {motion, useReducedMotion} from 'motion/react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

function LandingNav({onStart, disabled}:{onStart?: ()=>void; disabled?: boolean}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
    initial={reduceMotion ? false : {y: -100}}
    transition={reduceMotion ? { duration: 0 } : {delay: 0.3}}
    animate={{y: 0}}
    className='fixed z-20 w-full flex items-center justify-center py-3 px-3 sm:py-4'>
        <div className="flex w-full max-w-2xl items-center justify-between gap-2 rounded-3xl border bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-sm sm:gap-3 sm:px-3 sm:py-2">
            <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
            <Logo size='xs'/>
            <p className='truncate text-base font-semibold sm:text-lg'>
                 ShortIt
            </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <ThemeToggle />
                <Button
                type="button"
                size="sm"
                onClick={onStart}
                disabled={disabled}
                >
                  Get Started
                </Button>
            </div>
        </div>
    </motion.div>
  )
}

export default LandingNav
