'use client'

const GRADE_OPTIONS = ['PK', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

/** Numeric order for grade comparison */
function gradeIndex(grade: string): number {
  if (grade === 'PK') return -1
  if (grade === 'K') return 0
  return parseInt(grade, 10)
}

interface GradeSpanSelectorProps {
  label: string
  description?: string
  firstGrade: string
  lastGrade: string
  onFirstChange: (value: string) => void
  onLastChange: (value: string) => void
  inputCls?: string
  inputStyle?: React.CSSProperties
}

export default function GradeSpanSelector({
  label,
  description,
  firstGrade,
  lastGrade,
  onFirstChange,
  onLastChange,
  inputCls = 'w-full px-3.5 py-2.5 text-sm bg-white',
  inputStyle = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)' },
}: GradeSpanSelectorProps) {
  // Filter "last grade" options to only show grades >= first grade
  const lastOptions = firstGrade
    ? GRADE_OPTIONS.filter((g) => gradeIndex(g) >= gradeIndex(firstGrade))
    : GRADE_OPTIONS

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      {description && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="block text-xs text-gray-400 mb-1">First grade</span>
          <select
            value={firstGrade}
            onChange={(e) => {
              const newFirst = e.target.value
              onFirstChange(newFirst)
              // Auto-adjust last grade if it's now below the new first grade
              if (lastGrade && gradeIndex(lastGrade) < gradeIndex(newFirst)) {
                onLastChange(newFirst)
              }
            }}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">Select...</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="block text-xs text-gray-400 mb-1">Last grade</span>
          <select
            value={lastGrade}
            onChange={(e) => onLastChange(e.target.value)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">Select...</option>
            {lastOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
