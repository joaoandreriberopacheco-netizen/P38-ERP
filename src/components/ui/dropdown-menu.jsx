import React, { useState, useRef, useEffect, useContext, createContext } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/components/utils"

const DropdownMenuContext = createContext({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null }
})

const DropdownMenu = ({ children }) => {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

const DropdownMenuTrigger = React.forwardRef(({ children, asChild, ...props }, ref) => {
  const { setOpen, open, triggerRef } = useContext(DropdownMenuContext)
  const child = asChild ? React.Children.only(children) : children
  
  // Use the internal ref or the forwarded ref
  const internalRef = useRef(null)
  
  // Sync refs
  useEffect(() => {
    if (internalRef.current) {
      triggerRef.current = internalRef.current
    }
  })

  const handleClick = (e) => {
    e.stopPropagation()
    setOpen(!open)
    if (child.props?.onClick) child.props.onClick(e)
    if (props.onClick) props.onClick(e)
  }

  if (asChild) {
    return React.cloneElement(child, { 
      ...props, 
      onClick: handleClick, 
      ref: (node) => {
        internalRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }
    })
  }
  return (
    <button 
      onClick={handleClick} 
      ref={(node) => {
        internalRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }} 
      {...props}
    >
      {children}
    </button>
  )
})

const DropdownMenuContent = React.forwardRef(({ className, align = "center", children, sideOffset = 4, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useContext(DropdownMenuContext)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const contentRef = useRef(null)

  useEffect(() => {
    const updatePosition = () => {
      if (open && triggerRef.current && contentRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect()
        const contentRect = contentRef.current.getBoundingClientRect()
        
        let top = triggerRect.bottom + sideOffset
        let left = triggerRect.left

        if (align === "end") {
          left = triggerRect.right - contentRect.width
        } else if (align === "center") {
          left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2)
        }

        // Boundary checks (basic)
        if (left + contentRect.width > window.innerWidth) {
          left = window.innerWidth - contentRect.width - 8
        }
        if (left < 0) left = 8

        setPosition({ top, left })
      }
    }

    if (open) {
      // Initial position
      updatePosition()
      // Update on scroll/resize
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, align, sideOffset])

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contentRef.current && !contentRef.current.contains(event.target) && 
          triggerRef.current && !triggerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen])

  if (!open) return null

  return createPortal(
    <div
      ref={(node) => {
        contentRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      style={{ 
        position: 'fixed', 
        top: position.top, 
        left: position.left,
        // Ensure high z-index to float above everything
        zIndex: 9999 
      }}
      className={cn(
        "min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
  )
})

const DropdownMenuItem = React.forwardRef(({ className, onClick, onSelect, ...props }, ref) => {
  const { setOpen } = useContext(DropdownMenuContext)
  const activate = onClick || onSelect

  return (
    <div
      ref={ref}
      onClick={(e) => {
        setOpen(false)
        activate?.(e)
      }}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
        className
      )}
      {...props}
    />
  )
})

const DropdownMenuLabel = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))

const DropdownMenuShortcut = ({ className, ...props }) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
}