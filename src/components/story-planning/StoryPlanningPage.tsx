import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { AGE_RANGE_LABELS } from '@/lib/constants'
import { generateText } from '@/services/openai'
import { toast } from '@/stores/toastStore'
import {
  BRAINSTORM_SYSTEM,
  EXPAND_SYNOPSIS_SYSTEM,
  GENERATE_STORY_PLAN_SYSTEM,
  buildBrainstormPrompt,
  buildGenerateStoryPlanPrompt,
} from '@/lib/prompts'
import {
  Plus, Trash2, Send, Sparkles, Loader2, User, X,
  Wand2, Check, RotateCcw, ChevronDown, ChevronUp,
  BookOpen, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepNavButton } from '@/components/layout/StepNavButton'
import type { AgeRange, CharacterRole, Character } from '@/types'

// Type for the AI-generated story plan (before we add UUIDs to characters)
interface AIStoryPlan {
  title: string
  targetAgeRange: AgeRange
  themes: string[]
  characters: Array<{
    name: string
    description: string
    role: CharacterRole
    visualDescription: string
  }>
  synopsis: string
  moral: string
}

export function StoryPlanningPage() {
  const project = useActiveProject()
  const updateStoryPlan = useProjectStore((s) => s.updateStoryPlan)
  const addCharacter = useProjectStore((s) => s.addCharacter)
  const updateCharacter = useProjectStore((s) => s.updateCharacter)
  const removeCharacter = useProjectStore((s) => s.removeCharacter)

  // AI Generation state
  const [ideaInput, setIdeaInput] = useState('')
  const [ideaAgeRange, setIdeaAgeRange] = useState<AgeRange>('3-5')
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [generatedPlan, setGeneratedPlan] = useState<AIStoryPlan | null>(null)
  const [generateError, setGenerateError] = useState('')

  // Brainstorm chat state
  const [brainstormInput, setBrainstormInput] = useState('')
  const [brainstormResult, setBrainstormResult] = useState('')
  const [brainstormLoading, setBrainstormLoading] = useState(false)
  const [brainstormError, setBrainstormError] = useState('')

  // Manual editing state
  const [themeInput, setThemeInput] = useState('')
  const [previewThemeInput, setPreviewThemeInput] = useState('')
  const [expandLoading, setExpandLoading] = useState(false)
  const [manualFormOpen, setManualFormOpen] = useState(false)

  if (!project) return null
  const { storyPlan } = project

  // Check if fields are populated (to auto-open the manual form)
  const hasContent = storyPlan.title || storyPlan.synopsis || storyPlan.characters.length > 0

  // ---- AI Story Plan Generation ----
  const handleGeneratePlan = useCallback(async () => {
    if (!ideaInput.trim()) return
    setGeneratingPlan(true)
    setGenerateError('')
    setGeneratedPlan(null)
    try {
      const prompt = buildGenerateStoryPlanPrompt(ideaInput, ideaAgeRange)
      const result = await generateText(GENERATE_STORY_PLAN_SYSTEM, prompt)
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim()
      const parsed: AIStoryPlan = JSON.parse(cleaned)
      setGeneratedPlan(parsed)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate story plan'
      setGenerateError(msg)
      toast(msg, 'error')
    } finally {
      setGeneratingPlan(false)
    }
  }, [ideaInput, ideaAgeRange])

  const handleApplyPlan = useCallback(() => {
    if (!generatedPlan) return
    const characters: Character[] = generatedPlan.characters.map((c) => ({
      id: uuidv4(),
      name: c.name,
      description: c.description,
      role: c.role,
      visualDescription: c.visualDescription,
    }))
    updateStoryPlan({
      title: generatedPlan.title,
      targetAgeRange: generatedPlan.targetAgeRange,
      themes: generatedPlan.themes,
      characters,
      synopsis: generatedPlan.synopsis,
      moral: generatedPlan.moral,
    })
    setGeneratedPlan(null)
    setManualFormOpen(true)
    toast('Story plan applied', 'success')
  }, [generatedPlan, updateStoryPlan])

  const handleRegeneratePlan = useCallback(() => {
    setGeneratedPlan(null)
    handleGeneratePlan()
  }, [handleGeneratePlan])

  // ---- Brainstorm ----
  const handleBrainstorm = useCallback(async () => {
    if (!brainstormInput.trim()) return
    setBrainstormLoading(true)
    setBrainstormError('')
    try {
      const prompt = buildBrainstormPrompt({
        title: storyPlan.title,
        ageRange: storyPlan.targetAgeRange,
        themes: storyPlan.themes,
        existingSynopsis: storyPlan.synopsis,
        userRequest: brainstormInput,
      })
      const result = await generateText(BRAINSTORM_SYSTEM, prompt)
      setBrainstormResult(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to brainstorm'
      setBrainstormError(msg)
      toast(msg, 'error')
    } finally {
      setBrainstormLoading(false)
    }
  }, [brainstormInput, storyPlan])

  // ---- Manual editing helpers ----
  const handleAddTheme = () => {
    const theme = themeInput.trim()
    if (theme && !storyPlan.themes.includes(theme)) {
      updateStoryPlan({ themes: [...storyPlan.themes, theme] })
      setThemeInput('')
    }
  }

  const handleRemoveTheme = (theme: string) => {
    updateStoryPlan({ themes: storyPlan.themes.filter((t) => t !== theme) })
  }

  const handleExpandSynopsis = useCallback(async () => {
    if (!storyPlan.synopsis.trim()) return
    setExpandLoading(true)
    try {
      const prompt = `Title: "${storyPlan.title}"\nAge Range: ${storyPlan.targetAgeRange}\nThemes: ${storyPlan.themes.join(', ')}\nCharacters: ${storyPlan.characters.map((c) => c.name).join(', ')}\nCurrent Synopsis: ${storyPlan.synopsis}\nMoral: ${storyPlan.moral}\n\nExpand this into a complete story arc.`
      const result = await generateText(EXPAND_SYNOPSIS_SYSTEM, prompt)
      updateStoryPlan({ synopsis: result })
    } catch {
      toast('Failed to expand synopsis', 'error')
    } finally {
      setExpandLoading(false)
    }
  }, [storyPlan, updateStoryPlan])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* ===== AI STORY GENERATOR (Primary Flow) ===== */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-secondary/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-6 w-6 text-primary" />
            Generate Your Story
          </CardTitle>
          <CardDescription>
            Describe your book idea and AI will create a complete story plan — title, characters, synopsis, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label>Your Story Idea</Label>
              <Textarea
                value={ideaInput}
                onChange={(e) => setIdeaInput(e.target.value)}
                placeholder='e.g., "A shy octopus who wants to join a band but is afraid of performing on stage" or "A story about a girl who discovers her garden gnomes come alive at night"'
                rows={3}
                className="text-base"
              />
            </div>
            <div className="space-y-2 min-w-[180px]">
              <Label>Age Range</Label>
              <Select
                value={ideaAgeRange}
                onChange={(e) => setIdeaAgeRange(e.target.value as AgeRange)}
              >
                {Object.entries(AGE_RANGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
              <Button
                onClick={handleGeneratePlan}
                disabled={generatingPlan || !ideaInput.trim()}
                className="w-full mt-1"
                size="lg"
              >
                {generatingPlan ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                {generatingPlan ? 'Generating...' : 'Generate Story Plan'}
              </Button>
            </div>
          </div>

          {generateError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{generateError}</p>
          )}

          {/* ===== Generated Plan Preview (Editable) ===== */}
          {generatedPlan && (
            <div className="border-2 border-primary/30 rounded-xl bg-card p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary shrink-0" />
                    AI-Generated Story Plan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Edit any field below before applying</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={handleRegeneratePlan} disabled={generatingPlan}>
                    <RotateCcw className="h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button size="sm" onClick={handleApplyPlan} className="bg-green-600 hover:bg-green-700 text-white">
                    <Check className="h-4 w-4" />
                    Apply
                  </Button>
                </div>
              </div>

              {/* Title & Age */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title</Label>
                  <Input
                    value={generatedPlan.title}
                    onChange={(e) => setGeneratedPlan({ ...generatedPlan, title: e.target.value })}
                    className="text-lg font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Age Range</Label>
                  <Select
                    value={generatedPlan.targetAgeRange}
                    onChange={(e) => setGeneratedPlan({ ...generatedPlan, targetAgeRange: e.target.value as AgeRange })}
                  >
                    {Object.entries(AGE_RANGE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Themes */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Themes</Label>
                <div className="flex flex-wrap gap-1.5">
                  {generatedPlan.themes.map((theme) => (
                    <Badge
                      key={theme}
                      variant="secondary"
                      className="gap-1 cursor-pointer"
                      onClick={() => setGeneratedPlan({ ...generatedPlan, themes: generatedPlan.themes.filter((t) => t !== theme) })}
                    >
                      {theme} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={previewThemeInput}
                    onChange={(e) => setPreviewThemeInput(e.target.value)}
                    placeholder="Add a theme"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const t = previewThemeInput.trim()
                        if (t && !generatedPlan.themes.includes(t)) {
                          setGeneratedPlan({ ...generatedPlan, themes: [...generatedPlan.themes, t] })
                          setPreviewThemeInput('')
                        }
                      }
                    }}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const t = previewThemeInput.trim()
                      if (t && !generatedPlan.themes.includes(t)) {
                        setGeneratedPlan({ ...generatedPlan, themes: [...generatedPlan.themes, t] })
                        setPreviewThemeInput('')
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Characters */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Characters</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGeneratedPlan({
                      ...generatedPlan,
                      characters: [...generatedPlan.characters, { name: '', description: '', role: 'supporting', visualDescription: '' }],
                    })}
                  >
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
                <div className="space-y-3">
                  {generatedPlan.characters.map((char, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-muted/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary shrink-0" />
                        <Input
                          value={char.name}
                          onChange={(e) => {
                            const chars = [...generatedPlan.characters]
                            chars[i] = { ...chars[i], name: e.target.value }
                            setGeneratedPlan({ ...generatedPlan, characters: chars })
                          }}
                          placeholder="Character name"
                          className="font-semibold"
                        />
                        <Select
                          value={char.role}
                          onChange={(e) => {
                            const chars = [...generatedPlan.characters]
                            chars[i] = { ...chars[i], role: e.target.value as CharacterRole }
                            setGeneratedPlan({ ...generatedPlan, characters: chars })
                          }}
                          className="w-[140px] shrink-0"
                        >
                          <option value="protagonist">Protagonist</option>
                          <option value="antagonist">Antagonist</option>
                          <option value="supporting">Supporting</option>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => {
                            const chars = generatedPlan.characters.filter((_, idx) => idx !== i)
                            setGeneratedPlan({ ...generatedPlan, characters: chars })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        value={char.description}
                        onChange={(e) => {
                          const chars = [...generatedPlan.characters]
                          chars[i] = { ...chars[i], description: e.target.value }
                          setGeneratedPlan({ ...generatedPlan, characters: chars })
                        }}
                        placeholder="Personality, backstory, traits..."
                        rows={2}
                        className="text-sm"
                      />
                      <Textarea
                        value={char.visualDescription}
                        onChange={(e) => {
                          const chars = [...generatedPlan.characters]
                          chars[i] = { ...chars[i], visualDescription: e.target.value }
                          setGeneratedPlan({ ...generatedPlan, characters: chars })
                        }}
                        placeholder="Visual appearance: fur color, clothing, features..."
                        rows={2}
                        className="text-sm border-dashed"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Synopsis */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Synopsis</Label>
                <Textarea
                  value={generatedPlan.synopsis}
                  onChange={(e) => setGeneratedPlan({ ...generatedPlan, synopsis: e.target.value })}
                  rows={5}
                  className="text-sm leading-relaxed"
                />
              </div>

              {/* Moral */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Moral / Lesson</Label>
                <Textarea
                  value={generatedPlan.moral}
                  onChange={(e) => setGeneratedPlan({ ...generatedPlan, moral: e.target.value })}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Big Apply Button */}
              <div className="flex justify-center pt-2">
                <Button size="lg" onClick={handleApplyPlan} className="bg-green-600 hover:bg-green-700 text-white px-8">
                  <Check className="h-5 w-5" />
                  Apply This Story Plan
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== APPLIED PLAN / MANUAL EDITING ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Collapsible toggle for manual form */}
          <button
            onClick={() => setManualFormOpen(!manualFormOpen)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer",
              hasContent ? "bg-card hover:bg-accent/50" : "bg-muted/50 hover:bg-muted"
            )}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">
                  {hasContent ? (storyPlan.title || 'Story Details') : 'Story Details (Manual)'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasContent
                    ? `${storyPlan.characters.length} character${storyPlan.characters.length !== 1 ? 's' : ''} · ${storyPlan.themes.length} theme${storyPlan.themes.length !== 1 ? 's' : ''} · ${storyPlan.synopsis ? 'Synopsis set' : 'No synopsis'}`
                    : 'Click to manually fill in or edit your story plan'
                  }
                </p>
              </div>
            </div>
            {(manualFormOpen || hasContent) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </button>

          {(manualFormOpen || hasContent) && (
            <div className="space-y-6">
              {/* Story Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Story Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={storyPlan.title}
                        onChange={(e) => updateStoryPlan({ title: e.target.value })}
                        placeholder="The Brave Little Fox"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Age Range</Label>
                      <Select
                        value={storyPlan.targetAgeRange}
                        onChange={(e) => updateStoryPlan({ targetAgeRange: e.target.value as AgeRange })}
                      >
                        {Object.entries(AGE_RANGE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Themes</Label>
                    <div className="flex gap-2">
                      <Input
                        value={themeInput}
                        onChange={(e) => setThemeInput(e.target.value)}
                        placeholder="Add a theme (press Enter)"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTheme())}
                      />
                      <Button variant="outline" size="sm" onClick={handleAddTheme}>Add</Button>
                    </div>
                    {storyPlan.themes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {storyPlan.themes.map((theme) => (
                          <Badge key={theme} variant="secondary" className="gap-1 cursor-pointer" onClick={() => handleRemoveTheme(theme)}>
                            {theme} <X className="h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Moral / Lesson</Label>
                    <Textarea
                      value={storyPlan.moral}
                      onChange={(e) => updateStoryPlan({ moral: e.target.value })}
                      placeholder="What lesson should children take away from this story?"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Synopsis / Story Arc</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleExpandSynopsis}
                        disabled={expandLoading || !storyPlan.synopsis.trim()}
                      >
                        {expandLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Expand with AI
                      </Button>
                    </div>
                    <Textarea
                      value={storyPlan.synopsis}
                      onChange={(e) => updateStoryPlan({ synopsis: e.target.value })}
                      placeholder="Describe the story arc: beginning, middle, and end..."
                      rows={5}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Characters Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Characters</CardTitle>
                    <Button size="sm" onClick={addCharacter}>
                      <Plus className="h-4 w-4" /> Add Character
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {storyPlan.characters.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No characters yet. Add one to get started!</p>
                  ) : (
                    <div className="space-y-4">
                      {storyPlan.characters.map((char) => (
                        <div key={char.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                              <Input
                                value={char.name}
                                onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                                placeholder="Character name"
                              />
                              <Select
                                value={char.role}
                                onChange={(e) => updateCharacter(char.id, { role: e.target.value as CharacterRole })}
                              >
                                <option value="protagonist">Protagonist</option>
                                <option value="antagonist">Antagonist</option>
                                <option value="supporting">Supporting</option>
                              </Select>
                              <div className="flex justify-end">
                                <Button variant="ghost" size="icon" onClick={() => removeCharacter(char.id)} className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <Textarea
                            value={char.description}
                            onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                            placeholder="Personality, backstory, traits..."
                            rows={2}
                          />
                          <Textarea
                            value={char.visualDescription}
                            onChange={(e) => updateCharacter(char.id, { visualDescription: e.target.value })}
                            placeholder="Visual appearance (for AI art generation): fur color, clothing, features..."
                            rows={2}
                            className="border-dashed"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ===== RIGHT SIDEBAR: AI Brainstorm ===== */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" />
                AI Brainstorm
              </CardTitle>
              <CardDescription>
                Ask questions, get ideas, or refine your concept
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={brainstormInput}
                onChange={(e) => setBrainstormInput(e.target.value)}
                placeholder="e.g., 'Give me 3 story ideas about a brave rabbit' or 'What could be a funny twist?'"
                rows={3}
              />
              <Button
                onClick={handleBrainstorm}
                disabled={brainstormLoading || !brainstormInput.trim()}
                className="w-full"
              >
                {brainstormLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Brainstorm
              </Button>
              {brainstormError && (
                <p className="text-sm text-destructive">{brainstormError}</p>
              )}
              {brainstormResult && (
                <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {brainstormResult}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <StepNavButton />
    </div>
  )
}
