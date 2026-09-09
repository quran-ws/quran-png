import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormField,
  ImageCard,
  NumberInput,
  Rows,
  SegmentedControl,
  Select,
  Text,
  Title,
} from '@canva/app-ui-kit'
import { useIntl } from 'react-intl'
import { upload } from '@canva/asset'
import { addElementAtPoint } from '@canva/design'

const API = 'https://png.quran.ws/api/v1'

// What Canva places is a raster: 3000 px is generous for any print size a
// Canva design reaches, and small enough to upload quickly.
const INSERT_WIDTH = 3000
const THUMB_WIDTH = 600

type Surah = {
  number: number
  ayahs: number
  name_ar: string
  name_en: string
  name_latin: string
}

type Layout = 'mushaf' | 'fit'

export function App() {
  const intl = useIntl()

  const [surahs, setSurahs] = useState<Surah[]>([])
  const [surah, setSurah] = useState(1)
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(7)
  const [layout, setLayout] = useState<Layout>('mushaf')
  const [aspect, setAspect] = useState('square')
  const [color, setColor] = useState('#231f20')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unreachable = intl.formatMessage({
    defaultMessage: 'Could not reach png.quran.ws. Check your connection and try again.',
    description: 'Error shown when the app cannot load the list of surahs from the server.',
  })

  useEffect(() => {
    fetch(`${API}/surahs`)
      .then((r) => r.json())
      .then((d) => setSurahs(d.surahs))
      .catch(() => setError(unreachable))
  }, [])

  const current = surahs[surah - 1]

  // clamp the range whenever the surah changes under it
  useEffect(() => {
    if (!current) return
    setFrom((f) => Math.min(Math.max(1, f), current.ayahs))
    setTo((t) => Math.min(Math.max(1, t), current.ayahs))
  }, [current?.number])

  const imageURL = useMemo(() => {
    const range = to === from ? `${from}` : `${from}-${to}`
    const params = new URLSearchParams()
    if (layout === 'fit') {
      params.set('layout', 'fit')
      params.set('aspect', aspect)
    }
    if (color !== '#231f20') params.set('color', color)
    return (width: number) => `${API}/image/${surah}/${range}.png?${params}&width=${width}`
  }, [surah, from, to, layout, aspect, color])

  const aspects = [
    { value: 'square', label: intl.formatMessage({ defaultMessage: 'Square 1:1', description: 'A square image shape option.' }) },
    { value: 'post', label: intl.formatMessage({ defaultMessage: 'Post 4:5', description: 'A portrait social media post shape option, four by five.' }) },
    { value: 'story', label: intl.formatMessage({ defaultMessage: 'Story 9:16', description: 'A tall social media story shape option, nine by sixteen.' }) },
    { value: 'wide', label: intl.formatMessage({ defaultMessage: 'Wide 16:9', description: 'A landscape shape option, sixteen by nine.' }) },
    { value: 'banner', label: intl.formatMessage({ defaultMessage: 'Banner 3:1', description: 'A wide banner shape option, three by one.' }) },
  ]

  const inks = [
    { value: '#231f20', label: intl.formatMessage({ defaultMessage: 'Mushaf black', description: 'Colour option: the near-black ink the printed mushaf uses.' }) },
    { value: '#57534e', label: intl.formatMessage({ defaultMessage: 'Warm grey', description: 'Colour option for the text of the verse.' }) },
    { value: '#c4956a', label: intl.formatMessage({ defaultMessage: 'Gold', description: 'Colour option for the text of the verse.' }) },
    { value: '#1e3a34', label: intl.formatMessage({ defaultMessage: 'Deep green', description: 'Colour option for the text of the verse.' }) },
    { value: '#ffffff', label: intl.formatMessage({ defaultMessage: 'White', description: 'Colour option for the text of the verse, for dark backgrounds.' }) },
  ]

  async function addToDesign() {
    setBusy(true)
    setError(null)
    try {
      const asset = await upload({
        type: 'image',
        mimeType: 'image/png',
        url: imageURL(INSERT_WIDTH),
        thumbnailUrl: imageURL(THUMB_WIDTH),
        aiDisclosure: 'none',
        name: `Quran ${surah}:${from}${to === from ? '' : `-${to}`}`,
      })
      await addElementAtPoint({
        type: 'image',
        ref: asset.ref,
        altText: {
          // the ayah itself is the content; describe it rather than transcribe it
          text: intl.formatMessage(
            {
              defaultMessage:
                "Qur'an, surah {surah}, ayah {from} to {to}, as printed in the Madani mushaf",
              description:
                'Alt text describing the inserted image. Placeholders are the surah name and the first and last verse numbers.',
            },
            { surah: current?.name_en ?? String(surah), from, to }
          ),
          decorative: false,
        },
      })
    } catch {
      setError(
        intl.formatMessage({
          defaultMessage: 'That could not be added. Try again in a moment.',
          description: 'Error shown when inserting the image into the design failed.',
        })
      )
    } finally {
      setBusy(false)
    }
  }

  const invalid = !current || from < 1 || to < from || to > current.ayahs

  return (
    <Rows spacing="2u">
      <Rows spacing="0.5u">
        <Title size="small">
          {intl.formatMessage({
            defaultMessage: 'Quran',
            description: 'The name of the app, shown at the top of its panel.',
          })}
        </Title>
        <Text size="small" tone="tertiary">
          {intl.formatMessage({
            defaultMessage: 'Madani mushaf · Hafs an Asim',
            description:
              'Subtitle naming the edition of the Quran used: the Madani printing, in the Hafs an Asim reading.',
          })}
        </Text>
      </Rows>

      {error && <Alert tone="critical">{error}</Alert>}

      <FormField
        label={intl.formatMessage({
          defaultMessage: 'Surah',
          description: 'Label for the dropdown that picks a chapter of the Quran.',
        })}
        value={String(surah)}
        control={(props) => (
          <Select
            {...props}
            options={surahs.map((s) => ({
              value: String(s.number),
              label: `${s.number}. ${s.name_latin} — ${s.name_ar}`,
            }))}
            onChange={(v) => setSurah(Number(v))}
            placeholder={intl.formatMessage({
              defaultMessage: 'Loading…',
              description: 'Placeholder in the surah dropdown while the list is still loading.',
            })}
            stretch
          />
        )}
      />

      <Box display="flex" flexDirection="row">
        <Box flexGrow="1" paddingEnd="1u">
          <FormField
            label={intl.formatMessage({
              defaultMessage: 'From ayah',
              description: 'Label for the number input holding the first verse of the range.',
            })}
            value={from}
            control={(props) => (
              <NumberInput
                {...props}
                min={1}
                max={current?.ayahs}
                onChange={(v) => {
                  const n = Number(v || 1)
                  setFrom(n)
                  if (n > to) setTo(n)
                }}
              />
            )}
          />
        </Box>
        <Box flexGrow="1">
          <FormField
            label={intl.formatMessage({
              defaultMessage: 'To',
              description: 'Label for the number input holding the last verse of the range.',
            })}
            value={to}
            control={(props) => (
              <NumberInput
                {...props}
                min={from}
                max={current?.ayahs}
                onChange={(v) => setTo(Math.max(from, Number(v || from)))}
              />
            )}
          />
        </Box>
      </Box>

      {!invalid && (
        <ImageCard
          ariaLabel={intl.formatMessage({
            defaultMessage: 'Add the selected verses to the design',
            description: 'Accessible label for the preview image, which inserts the verses when pressed.',
          })}
          alt={intl.formatMessage({
            defaultMessage: 'Preview of the selected verses',
            description: 'Alt text for the preview thumbnail in the app panel.',
          })}
          thumbnailUrl={imageURL(THUMB_WIDTH)}
          borderRadius="standard"
          onClick={addToDesign}
        />
      )}

      <FormField
        label={intl.formatMessage({
          defaultMessage: 'Layout',
          description: 'Label for the choice between keeping the printed line breaks and repacking the words.',
        })}
        control={() => (
          <SegmentedControl
            value={layout}
            options={[
              {
                value: 'mushaf',
                label: intl.formatMessage({
                  defaultMessage: 'Mushaf lines',
                  description: 'Layout option: keep the line breaks of the printed page.',
                }),
              },
              {
                value: 'fit',
                label: intl.formatMessage({
                  defaultMessage: 'Fit to width',
                  description: 'Layout option: repack the words to fill a chosen image shape.',
                }),
              },
            ]}
            onChange={(v) => setLayout(v as Layout)}
          />
        )}
      />

      {layout === 'fit' && (
        <FormField
          label={intl.formatMessage({
            defaultMessage: 'Shape',
            description: 'Label for the dropdown that picks the aspect ratio of the image.',
          })}
          value={aspect}
          control={(props) => <Select {...props} options={aspects} onChange={setAspect} stretch />}
        />
      )}

      <FormField
        label={intl.formatMessage({
          defaultMessage: 'Ink',
          description: 'Label for the dropdown that picks the colour of the Arabic text.',
        })}
        value={color}
        control={(props) => <Select {...props} options={inks} onChange={setColor} stretch />}
      />

      <Button variant="primary" onClick={addToDesign} disabled={invalid || busy} loading={busy} stretch>
        {intl.formatMessage({
          defaultMessage: 'Add to design',
          description: 'The main button, which inserts the verses into the open design.',
        })}
      </Button>

      <Text size="small" tone="tertiary">
        {intl.formatMessage(
          {
            defaultMessage:
              'Placed as a transparent PNG at {width} px — resize it like any Canva element. Artwork: King Fahd Glorious Quran Printing Complex.',
            description:
              'Footnote explaining what gets inserted and crediting the source of the artwork. The placeholder is a pixel width.',
          },
          { width: INSERT_WIDTH }
        )}
      </Text>
    </Rows>
  )
}
