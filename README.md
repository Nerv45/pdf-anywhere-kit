# PDF editor 

Project Type: React Web Application for Client-Side PDF Processing

Objective:

Build a minimalist, fast, and secure single-page web application for managing and editing PDF files. The most critical constraint is that all processing must happen 100% locally in the user's browser. No backend, no server-side rendering, and no file uploads to external servers.

Core Tech Stack & Libraries:

Frontend: React, Tailwind CSS for styling (minimalist, clean, professional UI).

PDF Processing: pdf-lib (must be used for all PDF manipulations).

File Handling: react-dropzone (or native HTML5 Drag and Drop API) for uploading files.

Icons: lucide-react (for UI elements).

UI/UX Requirements:

A clean, modern dashboard layout.

A prominent, large Drag-and-Drop zone at the center/top of the screen.

Once a file (or files) is dropped, show a visual list or grid of the uploaded documents/pages.

A toolbar or sidebar with clearly labeled actions for the features below.

Provide a "Download Result" button once processing is complete.

Design the interface to comfortably handle wide formats (like landscape blueprints or geodetic maps) by ensuring page previews are responsive.

Functional Requirements:

Merge PDFs: Ability to drop multiple PDF files, reorder them via drag-and-drop, and merge them into a single PDF file.

Split PDF: Select a multi-page PDF and split it into individual single-page PDF files (downloaded as a ZIP using jszip), or extract a specific page range.

Delete Pages: Display thumbnails or list of pages for an uploaded PDF, allowing the user to select and delete specific pages before saving the final document.

Rotate Pages: Add buttons to rotate individual pages (or all pages) by 90 or 180 degrees.

Auto-Numbering: A feature to automatically add page numbers to the bottom-right corner of all pages in the document.

Add preview mode for PDF.

Behavioral Flow:

User drops a file -> File is read using FileReader API as ArrayBuffer.

User selects an action (e.g., Rotate, Delete) -> UI updates to show the pending changes.

User clicks "Apply & Save" -> pdf-lib processes the ArrayBuffer, generates a new PDF Blob.

App triggers an automatic browser download of the newly generated PDF file.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pdf-anywhere-kit.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/975139ee-30eb-409c-acda-c31c970e11cc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
