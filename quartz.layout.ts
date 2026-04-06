import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

/**
 * Ian's notes on the edits to the layout.
 * I've left this all at the defaults except:
 * 1. I commented out a few things that I didn't want, and
 * 2. I embedded a bunch of the header components in conditional render components so that they don't show on the home page
 *    a) Originally, only the breadcrumb component was conditionally rendered
 *
 * 2026-02-19 Update:
 * - I commented out all the conditional rendering components mentioned above because I'm switching this to a generalized "docs"
 *   site for Curbside and most pages are better within the extra stuff rendered. I still like the idea of having stats
 *   pages or something that are referencable elsewhere, so maybe you could re-render some of that stuff if pages have
 *   tags like "stat" or whatever.
 */

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      // GitHub: "https://github.com/jackyzha0/quartz",
      // "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    // Component.ConditionalRender({
    //   component: Component.Breadcrumbs(),
    //   condition: (page) => page.fileData.slug !== "index",
    // }),
    // Component.ConditionalRender({
    //   component: Component.ArticleTitle(),
    //   condition: (page) => page.fileData.slug !== "index",
    // }),
    // Component.ConditionalRender({
    //   component: Component.ContentMeta(),
    //   condition: (page) => page.fileData.slug !== "index",
    // }),
    // Component.ConditionalRender({
    //   component: Component.TagList(),
    //   condition: (page) => page.fileData.slug !== "index",
    // }),
  ],
  left: [
    // Component.PageTitle(),
    // Component.DesktopOnly(Component.TableOfContents()),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        // {
        //   Component: Component.Search(),
        //   grow: true,
        // },
        // { Component: Component.Darkmode() },
        // { Component: Component.ReaderMode() },
      ],
    }),
    // Component.Explorer(),
  ],
  right: [
    // Component.Graph(),
    // Component.DesktopOnly(Component.TableOfContents()),
    // Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        // { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
