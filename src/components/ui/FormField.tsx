import React from 'react'

interface FormFieldProps {
  label: string
  children: React.ReactNode
  hint?: string
}

export function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export function Input({ className = '', error, ...props }: InputProps) {
  return (
    <input
      {...props}
      // text-base = 1rem = 16px — iOS Safari auto-zooms the viewport for
      // any focused input with font-size < 16px, causing the jarring "blur"
      // effect on iPhone. Keep this at text-base or larger.
      className={`w-full bg-gray-800 border ${error ? 'border-rose-500' : 'border-gray-700'} rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base ${className}`}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      // text-base (16px) prevents iOS Safari auto-zoom on focus
      className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base ${className}`}
    >
      {children}
    </select>
  )
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClass = {
  primary: 'bg-brand-600 hover:bg-brand-500 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white',
  ghost: 'hover:bg-gray-800 text-gray-400 hover:text-white',
}

const sizeClass = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {children}
    </button>
  )
}
