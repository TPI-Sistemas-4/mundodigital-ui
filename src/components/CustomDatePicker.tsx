import React from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface Props {
  selected?: Date | null
  onChange: (date: Date | null) => void
  placeholderText?: string
  selectsStart?: boolean
  selectsEnd?: boolean
  startDate?: Date | null
  endDate?: Date | null
  minDate?: Date
  isClearable?: boolean
  dateFormat?: string
  width?: number | string
}


export function CustomDatePicker({ width, ...props }: Props) {
  return (
    <DatePicker
      {...props}
      dateFormat={props.dateFormat ?? 'dd/MM/yyyy'}
      customInput={
        <input
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '9px 12px',
            color: 'var(--text)',
            fontSize: 14,
            width: width ?? '100%',
            outline: 'none',
            fontFamily: 'DM Sans, sans-serif',
            cursor: 'pointer',
          }}
        />
      }
    />
  )
}
