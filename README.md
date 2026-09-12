<div align="center">

<img src=".github/banner.svg" alt="Quran PNG — Tool, Beta" width="820">

**Print-quality images of the real KFGQPC muṣḥaf — pick a surah and an ayah range, get a transparent PNG, SVG or PDF.**

<a href="https://quran.ws/tools/quran-png"><img alt="See it work" src="https://img.shields.io/badge/See_it_work-15705D?style=for-the-badge&labelColor=102F29"></a>
<a href="https://quran.ws/docs/reference/quran-png"><img alt="Documentation" src="https://img.shields.io/badge/Documentation-102F29?style=for-the-badge&labelColor=102F29"></a>
<a href="https://png.quran.ws"><img alt="Make an image" src="https://img.shields.io/badge/Make_an_image-D6AD64?style=for-the-badge&labelColor=102F29"></a>

</div>

> صُوَرٌ عاليةُ الجودة من المصحف، تُختار بالسورة ونطاق الآيات، بصيغ PNG وSVG وPDF بخلفيةٍ شفافة.

| | |
|---|---|
| **Built on** | Quran SVG Elements |
| **Formats** | PNG · SVG · PDF |
| **Licence** | MIT (code) · CC BY 4.0 (data and design) · KFGQPC terms (the text and the artwork) |

```sh
curl -O 'https://png.quran.ws/api/v1/image/1/1-7.png'
```

## Where the documentation is

Everything about using it lives on the site. This repository is the source.

| | |
|---|---|
| **Overview and demo** | [quran.ws/tools/quran-png](https://quran.ws/tools/quran-png) |
| **Reference** | [quran.ws/docs/reference/quran-png](https://quran.ws/docs/reference/quran-png) |
| **Make an image** | [png.quran.ws](https://png.quran.ws) |
| **Licensing in full** | [quran.ws/docs/reference/licensing](https://quran.ws/docs/reference/licensing) |

## What is in here

| | |
|---|---|
| `apps/api/` | the image service |
| `apps/web/` | the picker at png.quran.ws |
| `apps/quran-canva/` | the Canva app |
| `packages/` | shared code, including the Composer package |
| `data/` | the page data the renders are cut from |
| `deploy/` | how it is deployed |
| `design/` | store listing artwork and preview renders |
| `test/` | the gates that must stay green |

Issues and pull requests are welcome here. Everything that is not about *changing* this repository is on the site.
