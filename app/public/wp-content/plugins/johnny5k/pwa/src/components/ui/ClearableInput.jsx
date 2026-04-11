import { forwardRef, useImperativeHandle, useRef } from 'react'

function assignRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value)
    return
  }

  if (ref && typeof ref === 'object') {
    ref.current = value
  }
}

const ClearableInput = forwardRef(function ClearableInput(
  {
    className = '',
    wrapperClassName = '',
    clearLabel = 'Clear field',
    disabled = false,
    readOnly = false,
    type = 'text',
    value,
    ...props
  },
  ref,
) {
  const inputRef = useRef(null)
  const hasValue = typeof value === 'string'
    ? value.length > 0
    : typeof value === 'number'
      ? Number.isFinite(value)
      : Boolean(value)

  useImperativeHandle(ref, () => inputRef.current)

  function handleClear() {
    if (disabled || readOnly || !inputRef.current) return

    const input = inputRef.current
    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set

    valueSetter?.call(input, '')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
  }

  return (
    <div className={`clearable-input${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      <input
        {...props}
        ref={node => {
          inputRef.current = node
          assignRef(ref, node)
        }}
        className={className}
        type={type}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
      />
      {hasValue ? (
        <button
          type="button"
          className="clearable-input-button"
          aria-label={clearLabel}
          onMouseDown={event => event.preventDefault()}
          onClick={handleClear}
          disabled={disabled || readOnly}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </div>
  )
})

export default ClearableInput
