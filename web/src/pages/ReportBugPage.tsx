import { CSSProperties, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Colors } from '../lib/colors'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

export function ReportBugPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const mailtoLink = `mailto:bugs@loqit.app?subject=${encodeURIComponent(`[Bug Report] ${title}`)}&body=${encodeURIComponent(`Description:\n${description}\n\nReporter Email: ${email}\n\nPlatform: Web Desktop\nUser Agent: ${navigator.userAgent}`)}`
    
    window.open(mailtoLink)
    setSubmitted(true)
  }

  const containerStyle: CSSProperties = {
    padding: '32px',
    maxWidth: '800px',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px',
  }

  const backButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    color: Colors.onSurfaceVariant,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
  }

  const titleStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: 600,
    color: Colors.onSurface,
  }

  const formStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  }

  const textareaStyle: CSSProperties = {
    width: '100%',
    minHeight: '150px',
    padding: '12px 16px',
    backgroundColor: Colors.surfaceContainerHigh,
    border: `1px solid ${Colors.outlineVariant}`,
    borderRadius: '12px',
    color: Colors.onSurface,
    fontSize: '16px',
    resize: 'vertical',
    fontFamily: 'inherit',
  }

  const labelStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: Colors.onSurfaceVariant,
    marginBottom: '6px',
    display: 'block',
  }

  if (submitted) {
    return (
      <div style={containerStyle}>
        <Card style={{ textAlign: 'center', padding: '60px 40px' }}>
          <span
            className="material-icons"
            style={{ fontSize: '64px', color: Colors.secondary, marginBottom: '16px' }}
          >
            check_circle
          </span>
          <h2 style={{ color: Colors.onSurface, marginBottom: '12px' }}>Thank You!</h2>
          <p style={{ color: Colors.onSurfaceVariant, marginBottom: '24px' }}>
            Your bug report has been submitted. We'll look into it and get back to you if needed.
          </p>
          <Button onClick={() => navigate('/profile')}>Back to Profile</Button>
        </Card>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <button style={backButtonStyle} onClick={() => navigate(-1)}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 style={titleStyle}>Report a Bug</h1>
      </header>

      <Card>
        <p style={{ color: Colors.onSurfaceVariant, marginBottom: '24px' }}>
          Found something that's not working correctly? Let us know and we'll fix it as soon as
          possible.
        </p>

        <form onSubmit={handleSubmit} style={formStyle}>
          <Input
            label="Bug Title"
            placeholder="Brief description of the issue"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div>
            <label style={labelStyle}>Description *</label>
            <textarea
              style={textareaStyle}
              placeholder="Please describe what happened, what you expected to happen, and steps to reproduce the bug..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <Input
            label="Your Email (optional)"
            type="email"
            placeholder="For follow-up questions"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Card
            style={{
              backgroundColor: Colors.surfaceContainerHigh,
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span className="material-icons" style={{ color: Colors.tertiary }}>
                info
              </span>
              <p style={{ color: Colors.onSurfaceVariant, fontSize: '14px', margin: 0 }}>
                This will open your email client with a pre-filled bug report. You can add
                screenshots or additional details before sending.
              </p>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit">
              <span className="material-icons" style={{ fontSize: '18px' }}>
                send
              </span>
              Submit Report
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
