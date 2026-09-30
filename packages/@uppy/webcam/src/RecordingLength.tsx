import type { I18n } from '@uppy/core/utils'
import formatSeconds from './formatSeconds.js'

interface RecordingLengthProps {
  recordingLengthSeconds: number
  i18n: I18n
}

export default function RecordingLength({
  recordingLengthSeconds,
  i18n,
}: RecordingLengthProps) {
  const formattedRecordingLengthSeconds = formatSeconds(recordingLengthSeconds)

  return (
    <span
      role="timer"
      aria-label={i18n('recordingLength', {
        recording_length: formattedRecordingLengthSeconds,
      })}
    >
      {formattedRecordingLengthSeconds}
    </span>
  )
}
