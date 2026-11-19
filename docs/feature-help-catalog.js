/* Curated app help. Descriptions are app metadata; never derive speech from field values or preview content. */
(() => {
  'use strict';
  const entries = new Map(), rules = [];
  const add = (key, title, text, selector = '') => {
    entries.set(key, { key, title, text });
    if (selector) rules.push([selector, key]);
  };
  for (const c of commands()) {
    add(c.id, c.label, c.description);
    if (c.id.startsWith('#') && !c.id.includes(':')) rules.push([c.id, c.id]);
  }
  const controls = [
    ['src','Site address','Enter the website to open on the device wall. The extension can open your own pages; the web demo uses the bundled sample site.'],
    ['search-tools','Search tools and features','Find any Samestate tool by name or purpose. Filter by category, then choose a result. Press Command K or Control K to open this search.'],
    ['feature-help-open','Feature help','Open the help browser from the question-mark icon in the top bar. Search for a feature, button or section, choose its explanation, and press Hear explanation for natural voice guidance.'],
    ['toggle-sidebar','Preview settings','Show or hide the sidebar containing devices, capture, layout, sync, themes and test settings.'],
    ['reload','Reload every preview','Reload the current page in every preview. Temporary changes to a page may be lost.'],
    ['ui-mode','Day and night mode','Switch the Samestate interface between light and dark appearance.'],
    ['ui-theme','Interface theme','Choose the appearance of Samestate itself. Preview-page palettes are configured separately in the Theme section.'],
    ['sites-toggle','Compare sites','Place separate websites or pages in side-by-side columns, each with its own address and preview wall.'],
    ['add-site','Add comparison site','Add another website column to the current side-by-side comparison.'],
    ['demo','Guided demo','Explore all 46 guided steps with natural AI narration, Previous and Next controls, and direct step selection.'],
    ['watch','Watch the demo','Start the guided walkthrough on the bundled sample website.'],
    ['own','Use your own site','Open your own website in the installed Chrome extension to inspect it across devices.'],
    ['screenshot','Screenshot','Save the currently visible device wall as an image, using the selected capture format and destination.'],
    ['record','Record the device wall','Start or stop a video recording of the visible device wall. Recordings split into separate files at 10 megabytes.'],
    ['auto-shots','Automatic screenshots','Start or stop repeated screenshots at the pace chosen below.'],
    ['full-page-shot','Full-page screenshot','Capture the full scrollable length of the selected preview by scrolling and stitching it together.'],
    ['overview-shot','Overview screenshot','Capture all selected screens on one sheet, including previews outside the visible wall.'],
    ['full-page-screen','Full-page capture screen','Choose which preview is scrolled and captured for a full-page screenshot.'],
    ['shot-format','Screenshot format','Choose PNG, JPEG or PDF for screenshots. PNG preserves crisp interface detail; JPEG is useful for photographs.'],
    ['shot-rate','Screenshot pace','Set how frequently automatic screenshots are saved. Use the adjacent unit to choose a rate or a delay.'],
    ['shot-unit','Screenshot pace unit','Choose screenshots per second or seconds between screenshots.'],
    ['record-rate','Recording frame rate','Set frames per second for video recording. Lower rates reduce file size; higher rates capture smoother movement.'],
    ['capture-folder','Capture destination','Choose the folder where screenshots and recording parts are saved.'],
    ['capture-folder-clear','Use Downloads','Return capture saving to the browser’s default Downloads destination.'],
    ['workspace-name','Workspace name','Name the current device and layout setup before saving it as a reusable workspace.'],
    ['workspace-export','Export workspaces','Download your saved device setups as a JSON file for backup or sharing.'],
    ['workspace-import','Import workspaces','Choose a Samestate workspace JSON file and add its saved setups to this browser.'],
    ['workspace-file','Workspace file','Select an exported Samestate workspace file to import.'],
    ['device-search','Search devices','Filter device presets by their name or dimensions. This search does not change the current selection.'],
    ['selected-devices','Selected devices only','Limit the device catalogue to the previews currently selected.'],
    ['add-device','Add custom device','Define a named viewport with your own width, height and device frame.'],
    ['device-sizes','Device sizing mode','Choose different device sizes, or show the same device size on every screen for direct state comparisons.'],
    ['shared-device','Shared device','Choose the device size used by all previews in same-device mode and page-step journeys.'],
    ['device-identity','Phone and tablet identity','Let phone and tablet previews report their own user agent, touch support, pixel ratio and screen size. Changing this reloads the previews.'],
    ['sign-ins','Use your Chrome sign-ins','Let extension previews use your Chrome cookies and site storage. Turning this off starts isolated, signed-out previews.'],
    ['page-steps','Page steps','Lay out successive pages and interface states side by side at one device size. Following a link or opening a dialog adds a step.'],
    ['journey','Check the page-step journey','Measure each recorded page step at every selected device size and compare it with the desktop.'],
    ['screen-settings','Screen settings','Give alternating previews different browser preferences or visual conditions to compare how the page responds.'],
    ['screen-lang','Page language','Set the language reported by alternate previews to test language-dependent page behaviour.'],
    ['find-breakpoints','Find CSS breakpoints','Read responsive width boundaries from accessible stylesheets on the reference page.'],
    ['breakpoint-edges','Include the pixel below','Add a preview one pixel below each CSS breakpoint so both sides of the layout change can be compared.'],
    ['open-breakpoints','Open breakpoint screens','Create temporary previews at the discovered responsive widths.'],
    ['close-breakpoints','Restore your devices','Close the temporary breakpoint previews and restore your previous device selection.'],
    ['theme-target','Preview theme target','Apply a preview palette to all visible screens, one device, or one comparison column.'],
    ['theme-preset','Preview theme preset','Choose a bundled or tweakcn colour palette to try on the website previews.'],
    ['theme-css','Custom theme CSS','Paste the theme CSS exported from tweakcn to preview its colours on the selected screens.'],
    ['theme-palette','Preview palette mode','Use the site’s current palette, or force the selected preview theme into its light or dark version.'],
    ['theme-basic','Recolour basic elements','Apply the preview palette to common page backgrounds, text and buttons, including sites with hard-coded colours.'],
    ['apply-theme','Apply preview theme','Apply the selected palette and settings to the chosen preview target.'],
    ['reset-theme','Reset preview theme','Remove the theme override from the selected previews and return to the page’s original colours.'],
    ['land','All previews to landscape','Rotate touch-device previews into landscape orientation.'],
    ['port','All previews to portrait','Return touch-device previews to portrait orientation.'],
    ['lock','Lock preview layout','Prevent accidental rearrangement of the current device-wall layout. Toggle again to allow placement changes.'],
    ['zoom','Wall zoom','Change the overall scale of the preview wall. Individual previews can also have their own scale.'],
    ['rz','Reset wall zoom','Return the preview wall to its normal zoom level.'],
    ['match-text','Match visible text','Use visible text as another way to match controls between linked previews. Matching runs locally.'],
    ['alignall','Align linked screens','Bring every linked preview to the page and scroll position of the screen used most recently.'],
    ['play-videos','Play all preview videos','Start the main video in every connected preview and show each playback result in the Sync log.'],
    ['pause-videos','Pause all preview videos','Pause the main video in every connected preview.'],
    ['live-reload','Live reload','Reload linked previews on a timer, or watch local sites for changed scripts, stylesheets and page content.'],
    ['detect','Detect differences','Measure the selected previews against the reference screen and group layout, content, accessibility and page-health findings.'],
    ['ref','Reference screen','Choose the preview used as the baseline for comparisons and tools that inspect a single reference page.'],
    ['sweep','Sweep responsive widths','Test the reference preview from 320 to 1920 CSS pixels and narrow down the widths where responsive problems appear.'],
    ['check-links','Check broken links','Check accessible same-origin links for missing pages and server errors. Action links such as sign-out and delete are skipped.'],
    ['long-text','Longer preview text','Expand page text by about 35 percent to reveal clipping and wrapping problems caused by translation or longer content.'],
    ['find-selector','Find elements','Enter a CSS selector and highlight matching elements across all connected previews.'],
    ['find-prev','Previous matching element','Move the shared element highlight to the previous match of the current CSS selector.'],
    ['open-checks','Run all checks','Choose test groups, run them together, then collect automated results and human visual reviews in one report.'],
    ['checks-run','Run selected checks','Run the selected check groups on the current devices and reference screen. Visual review decisions remain yours to record.'],
    ['checks-stop','Stop checks','Stop the current grouped run after its active measurement and restore temporary settings.'],
    ['checks-show-results','Open combined results','Show the combined automated findings and visual review cards from the current check run.'],
    ['checks-select-all','Select all check groups','Select every check group. Configure a saved journey or AI connection before running journey checks.'],
    ['checks-select-none','Clear group selection','Deselect every check group so you can choose a smaller set.'],
    ['checks-journey-mode','Journey check mode','Run your saved test locally, or let the configured AI service follow the test plan.'],
    ['checks-configure-test','Configure the test journey','Open Test runs to load a saved test or configure an AI service and a test plan.'],
    ['test-plan','Test plan','Describe the journey and expected behaviour that an AI should turn into repeatable test steps.'],
    ['test-write','Write a test with AI','Ask the configured AI to follow the plan on the reference preview and replay its steps on the other screens.'],
    ['test-stop','Stop test run','Stop the current test-writing, replay or click-recording operation.'],
    ['ai-provider','AI provider','Choose OpenRouter or another service that supports the OpenAI-compatible chat API.'],
    ['ai-base','AI service address','Set the base address of the AI service used to write tests. Your field value is not read by voice help.'],
    ['ai-model','AI model','Choose the model identifier supplied by your AI provider for test writing.'],
    ['ai-key','AI API key','Enter the credential required by your AI provider. Voice help does not read or speak this field’s value.'],
    ['ai-remember','Remember the API key','Store the AI credential in this browser for later test-writing sessions. Leave this off to keep it only for the current session.'],
    ['test-record','Record test clicks','Record your clicks and page navigation as reusable test steps. This records actions, not microphone audio.'],
    ['test-run','Replay saved test','Run every saved test step on each linked preview without asking an AI service.'],
    ['test-check','Expected text','Enter text that should appear on every preview, then add it as a test assertion.'],
    ['test-open','Open test file','Load a saved Samestate test journey from a JSON file.'],
    ['test-file','Saved test file','Select a Samestate test JSON file to load its journey steps.'],
    ['test-save','Save test file','Download the current journey as a reusable Samestate test JSON file.'],
    ['test-clear','Clear test steps','Remove the current test journey from this browser.'],
    ['wall-scroll','Scroll the preview wall','Move horizontally through the device wall to reach previews outside the visible area.'],
    ['tour-step','Choose demo step','Jump directly to any of the 46 guided steps. Samestate prepares that feature’s scene and holds it after the explanation.'],
    ['tour-prev','Previous demo step','Return to the previous scene and replace its narration with the matching explanation.'],
    ['tour-next','Next demo step','Move forward to the next scene and its narration without waiting for the current explanation to finish.'],
    ['tourpause','Pause or resume the demo','Pause both the guided actions and narration. Resume continues automatic playback.'],
    ['tour-mute','Mute demo narration','Turn demo narration off or on. The choice is saved in this browser.'],
    ['tour-intro-name','Samestate demo intro','The demo opens with what Samestate is for: test your site on every screen size at once, click once and every device follows, then see what breaks.'],
    ['tour-intro-play','Start the demo','Start the 46-step guided demo with narration. Starting it with a click also lets the browser play the voice from the first word.'],
    ['tour-intro-explore','Skip the demo and explore','Close the intro and use the app on the sample site, without the guided demo.'],
    ['tour-intro-skip','Skip the intro','End the intro and go straight to the first demo step.'],
    ['skip','Close the guided demo','Stop the walkthrough and narration, restore temporary demo settings, and keep the sample site available to explore.'],
    ['closepanel','Close results panel','Hide the right-hand panel to give the preview wall more room.'],
    ['open-outline','Outline and measurements','Inspect headings, landmarks and keyboard order, measure an element’s CSS dimensions, and review practical suggestions.'],
    ['outline-screen','Inspection screen','Choose the preview whose structure and element measurements are shown in the Outline panel.'],
    ['outline-refresh','Refresh the outline','Read the selected preview’s current headings, landmarks and estimated keyboard focus order again.'],
    ['outline-pick','Pick a page element','Select an element directly inside the preview to inspect its dimensions, spacing, typography and contrast.'],
    ['outline-export','Export outline data','Download the current outline and measurements as a JSON file.'],
    ['outline-headings-overlay','Heading overlays','Mark heading levels on the inspected preview to make the page’s hierarchy visible.'],
    ['outline-landmarks-overlay','Landmark overlays','Outline page regions such as navigation, main content and footer on the inspected preview.'],
    ['outline-focus-overlay','Keyboard focus overlay','Number estimated keyboard focus stops on the preview. Verify the actual sequence with Tab and Shift Tab.'],
    ['outline-clear','Clear inspection overlays','Remove the heading, landmark, focus-order and selected-element highlights.'],
    ['outline-mode','Outline view','Switch between the page’s headings, landmark regions and estimated keyboard focus sequence.'],
    ['outline-issues-only','Suggestions only','Limit the outline list to items that have a structural or best-practice suggestion.'],
    ['console-level','Console message filter','Show all grouped preview messages, or limit them to errors, warnings, logs and information.'],
    ['console-clear','Clear console messages','Clear the collected preview messages from the current Console view.'],
    ['checks-export-html','Export combined HTML report','Save automated results, human review decisions and notes as a readable HTML report.'],
    ['checks-export-json','Export combined JSON report','Save combined check results and review notes as structured JSON data.'],
    ['design-file','Design reference image','Choose a design export to overlay on this preview for visual comparison.'],
    ['design-scale','Design export scale','Tell Samestate whether the reference image was exported at one, two or three times its design size.'],
    ['design-opacity','Design overlay opacity','Adjust how transparent the reference image is over the live page.'],
    ['design-mode','Design blend mode','Use normal, difference or inverted blending to make mismatches between the design and page easier to see.'],
    ['design-split','Design split view','Reveal part of the reference image beside the live page for a split comparison.'],
    ['design-x','Design horizontal offset','Move the reference image left or right to align it with the page.'],
    ['design-y','Design vertical offset','Move the reference image up or down to align it with the page.'],
    ['design-visible','Show design reference','Show or hide the reference image while keeping its alignment and settings.'],
    ['design-remove','Remove design reference','Remove the reference image from this preview.'],
    ['grid-columns','Grid columns','Set how many columns are drawn by the column-grid overlay.'],
    ['grid-gutter','Grid gutter','Set the gap in CSS pixels between adjacent overlay columns.'],
    ['grid-max','Grid maximum width','Set the maximum content width of the column-grid overlay.'],
    ['grid-margin','Grid side margin','Set the space between the column-grid overlay and the viewport edges.'],
    ['grid-baseline','Baseline spacing','Set the CSS-pixel spacing between the horizontal baseline-grid lines.'],
    ['command-input','Search tools and features','Search by a tool’s name, a synonym or what you want to do. Field values and preview-page text are not searched.'],
    ['command-category','Tool category','Limit the tool search to a category such as Capture, Debug, Reports or Test runs.'],
    ['command-close','Close tool search','Close the tool search and return focus to the control that opened it.'],
    ['preview-scale-value','Preview percentage','Set the scale of this preview as a percentage of its CSS pixel size.'],
    ['physical-calibration-mm','Monitor calibration','Measure the displayed calibration line on your monitor and enter its length in millimetres.'],
    ['physical-screen-mm','Physical screen width','Enter the real device’s screen width in millimetres to match its physical size on your monitor.'],
    ['annotation-note-text','Preview note','Write a note to place on the preview. Notes can be included in captures; voice help does not read their contents.']
  ];
  for (const [id, title, text] of controls) add('#' + id, title, text, '#' + id);
  const sections = {
    Capture:'Save screenshots, full-page images, overview sheets and recordings. Set their format, pace and destination here.',
    Workspaces:'Save and reopen device and layout setups, or export and import them for backup and sharing.',
    Devices:'Search device presets, select the screens on your wall, and create custom viewport sizes.',
    Views:'Choose sizing modes, page-step journeys, browser preferences and responsive breakpoint previews.',
    Theme:'Try colour palettes on the website previews and control which screens receive them.',
    Layout:'Arrange the device wall, align previews, set orientation and zoom, or lock an arrangement.',
    Sync:'Control which actions are mirrored between linked previews, align screens and configure live reload.',
    Compare:'Choose a reference screen, detect differences, sweep responsive widths and test longer text or broken links.',
    'Find elements':'Find elements by CSS selector and inspect matching positions across your previews.',
    'Run all checks':'Combine selected automated checks with human visual reviews and export one result.',
    'Test runs':'Write, record, import, replay and save test journeys, with optional AI assistance.',
    'AI connection':'Configure the provider, address, model and credential used for AI test writing.',
    'Physical size':'Calibrate your monitor and enter a real device width to show a physically sized preview.'
  };
  for (const [name,text] of Object.entries(sections)) { add('section:'+name, name, text); if(entries.has('drawer:'+name))add('drawer:'+name,'Open '+name,text); }
  const templates = [
    ['preset','Device preset','Select or remove this device size from the preview wall.','#devlist .device-option label,#devlist .device-option input'],
    ['device-group','Device group','Expand or collapse this group of device presets.','.device-group>summary'],
    ['remove-device','Remove custom device','Delete this custom device preset from the device catalogue.','.device-remove'],
    ['custom-name','Custom device name','Give your custom viewport a recognisable name.','#custom-device-form [name=name]'],
    ['custom-width','Custom viewport width','Set the custom viewport width in CSS pixels.','#custom-device-form [name=width]'],
    ['custom-height','Custom viewport height','Set the custom viewport height in CSS pixels.','#custom-device-form [name=height]'],
    ['custom-frame','Custom device frame','Choose the phone, tablet or desktop frame surrounding the custom viewport.','#custom-device-form [name=frame]'],
    ['custom-save','Save custom device','Add this named viewport to your custom device presets.','#custom-device-form button[type=submit]'],
    ['workspace-save','Save workspace','Save the current selected devices and preview layout under the name you entered.','#workspace-form button[type=submit]'],
    ['workspace-open','Open saved workspace','Restore this saved device and layout setup.','.workspace .pill'],
    ['workspace-delete','Delete saved workspace','Remove this saved setup from your workspace list.','.workspace-delete'],
    ['next-match','Next matching element','Highlight the next match of the current CSS selector across all connected previews.','#find-form button[type=submit]'],
    ['add-assertion','Add text assertion','Add a test step that checks whether your expected text appears on every linked preview.','#test-check-form button[type=submit]'],
    ['remove-step','Remove test step','Remove this step from the current saved test journey.','.test-step-remove'],
    ['screen-scale','Preview scale','Change this preview’s scale or calibrate its physical size on your monitor.','[data-a=scale]'],
    ['screen-debug','Preview debug tools','Choose debug overlays and visual simulators for this preview.','[data-a=debug]'],
    ['screen-link','Link or unlink preview','Include this screen in synchronized actions, or unlink it to keep an independent page state.','[data-a=link]'],
    ['screen-rotate','Rotate preview','Switch this touch-device preview between portrait and landscape.','[data-a=rot]'],
    ['screen-reload','Reload preview','Reload the page on this preview only.','[data-a=rel]'],
    ['screen-focus','Focus this preview','Show this preview on its own, or return to the current device-wall arrangement.','[data-a=foc]'],
    ['screen-close','Close preview','Remove this screen from the current wall or journey.','[data-a=close]'],
    ['screen-name','Move a preview','Drag this title bar to place the preview on the wall when the layout is unlocked.','.dev-name'],
    ['viewport','Viewport dimensions','These are the page viewport dimensions in CSS pixels, before preview scaling.','.viewport-size'],
    ['annotate','Preview annotations','Open drawing tools for notes, lines, arrows and freehand marks on this preview.','.annotation-toggle'],
    ['annotation-draw','Freehand drawing','Drag on the annotation layer to draw a freehand mark.','.annotation-tools [data-tool=draw]'],
    ['annotation-line','Draw a line','Drag on the annotation layer to place a straight line.','.annotation-tools [data-tool=line]'],
    ['annotation-arrow','Draw an arrow','Drag on the annotation layer to point out an element with an arrow.','.annotation-tools [data-tool=arrow]'],
    ['annotation-note','Place a note','Choose a position on the preview and add a written note.','.annotation-tools [data-tool=note]'],
    ['annotation-erase','Erase annotation','Select an existing annotation to remove it.','.annotation-tools [data-tool=erase]'],
    ['note-edit','Edit preview note','Open this preview note for editing.','.preview-note'],
    ['note-save','Save preview note','Place the written note on the selected preview.','#annotation-note-dialog button[value=save]'],
    ['note-cancel','Cancel note editing','Close the note editor without saving the changes.','#annotation-note-dialog button[value=cancel]'],
    ['site-address','Comparison site address','Enter the website or page for this comparison column.','.site-url'],
    ['site-open','Open comparison page','Load this column’s entered address in its previews.','.site-address button[type=submit]'],
    ['site-close','Close comparison column','Remove this website column from the comparison.','.site-close'],
    ['site-preset','Comparison viewport','Choose the viewport or device-wall setup for this comparison column.','.site-preset'],
    ['review-tools','Open visual review tools','Open the tool associated with this visual review so you can inspect the page before deciding.','[data-review-open]'],
    ['review-pass','Pass visual review','Record that you inspected this visual item and it passed.','[data-review-status=passed]'],
    ['review-fail','Fail visual review','Record that your inspection found a problem in this visual item.','[data-review-status=failed]'],
    ['review-skip','Skip visual review','Record that this visual item was not reviewed in this run.','[data-review-status=skipped]'],
    ['review-reset','Reset visual review','Return this item to awaiting human review and clear its decision.','[data-review-status=review]'],
    ['review-notes','Visual review notes','Add evidence or comments for this review. The notes are included in exported combined reports.','[data-review-notes]'],
    ['checks-stop-live','Stop combined checks','Stop the active grouped check run and restore temporary settings.','[data-checks-stop]'],
    ['outline-item','Inspect outline element','Highlight this page element and read its CSS dimensions, spacing, typography and related suggestions.','[data-outline-key]'],
    ['w3c-guidance','Accessibility guidance','Open the linked W3C guidance for the associated accessibility or best-practice suggestion.','.outline-suggestion a'],
    ['finding','Difference finding','Inspect the finding details and highlight the affected element on the relevant previews.','.finding'],
    ['finding-screen','Finding screen','Show the details for this affected preview and highlight its corresponding element.','.screen-chip'],
    ['fix','Preview a suggested fix','Try or undo a temporary CSS fix in the previews. The source website is not edited.','[data-fix]'],
    ['rescan','Detect differences again','Run a fresh scan to update the report and retry previews that did not answer.','[data-rescan]'],
    ['category','Finding category','Filter the difference report to this category of findings.','[data-cat]'],
    ['report-issue','Findings by issue','Group the same kind of finding together and show the devices it affects.','[data-view=issue]'],
    ['report-device','Findings by device','List report findings under the individual previews they affect.','[data-view=device]'],
    ['baseline-save','Save comparison baseline','Save or replace the current findings as the baseline for later scans of this site.','[data-baseline=save]'],
    ['baseline-clear','Clear comparison baseline','Remove the saved baseline for this site.','[data-baseline=clear]'],
    ['baseline-new','New findings only','Show findings that appeared after the saved comparison baseline.','[data-baseline=new]'],
    ['baseline-recheck','Check preview fixes again','Scan the page again after applying or undoing temporary preview fixes.','[data-baseline=recheck]'],
    ['baseline-undo','Undo all preview fixes','Remove every temporary CSS fix currently applied to the previews.','[data-baseline=undo-fixes]'],
    ['metadata-read','Read metadata','Read the reference page’s title, description, social cards, canonical URL and other metadata again.','[data-meta=read]'],
    ['card-light','Light social card preview','Show social-sharing cards as they would appear on a light background.','[data-card-theme=light]'],
    ['card-dark','Dark social card preview','Show social-sharing cards as they would appear on a dark background.','[data-card-theme=dark]'],
    ['report-export','Export difference report','Choose a file format and save the current difference findings.','.report-export>summary'],
    ['scale-apply','Apply preview scale','Apply the entered preview percentage to this screen.','#preview-scale button[value=apply]'],
    ['scale-css','Actual CSS pixel scale','Show the preview at one display pixel per CSS pixel before browser-level scaling.','#preview-scale button[value="100"]'],
    ['scale-auto','Automatic preview scale','Return this preview to the scale calculated for the wall layout.','#preview-scale button[value=auto]'],
    ['scale-cancel','Cancel scale change','Close the scale dialog without applying the entered value.','#preview-scale button[value=cancel]'],
    ['scale-physical','Match physical screen size','Apply monitor calibration and the entered real device width to this preview.','#preview-scale button[value=physical]'],
    ['dialog-done','Done with settings','Close this settings dialog. Changes already applied to the preview remain in effect.','dialog button[value=close]'],
    ['align-top','Align previews to top','Align the device previews along their top edges.','#align [data-v=flex-start]'],
    ['align-middle','Align previews to middle','Align the device previews by their vertical centres.','#align [data-v=center]'],
    ['align-bottom','Align previews to bottom','Align the device previews along their bottom edges.','#align [data-v=flex-end]'],
    ['home','Samestate','Open the Samestate home view.','.brand'],
    ['request-device','Request a device preset','Open a GitHub feature request for a missing device preset.','.device-request'],
    ['theme-editor','Open theme editor','Open tweakcn to create a palette, then copy its exported CSS into the custom-theme field.','#theme-custom>a'],
    ['metadata-link','Metadata preview link','Open the link associated with this metadata or social-sharing preview.','#meta-view a'],
    ['debug-section','Debug tools and simulators','Apply debugging overlays or a visual simulator to the selected preview or the whole wall. Several debug tools can be combined.','.debug-menu .debug-heading,.debug-menu .debug-group'],
    ['measurements','Measurements and suggestions','Inspect the selected element’s size, box model, typography and practical guidance.','.outline-section>summary'],
    ['computed','Computed styles','Expand the element’s computed styles and its distances from the viewport edges.','.outline-css>summary'],
    ['measurement-value','CSS measurement','Measurements use CSS pixels before preview scaling and visual filters. Check the selected element in the live preview.','.outline-metrics dt'],
    ['review-card','Combined check result','Review this group’s status, findings and any human review decisions or notes.','.check-result,.check-result h3'],
    ['result-details','Expand result details','Expand or collapse the findings or journey details for this result.','.check-result summary,#baseline summary'],
    ['search-result','Search result','Choose this result to open or run the matching Samestate tool.','#command-list [data-i]']
  ];
  for (const [key,title,text,selector] of templates) add(key,title,text,selector);
  for (const format of ['md','csv','html','html-shots']) rules.push([`[data-export="${format}"]`,'export:'+format]);
  const metrics = {
    'Width × height':['Element size','The selected element’s rendered width and height in CSS pixels, before preview scaling.'],
    'Page x / y':['Page position','The selected element’s horizontal and vertical position relative to the full page.'],
    'Margin · T/R/B/L':['Element margin','The outer spacing around the element, listed as top, right, bottom and left.'],
    'Padding · T/R/B/L':['Element padding','The inner spacing between the element’s content and border, listed as top, right, bottom and left.'],
    'Border · T/R/B/L':['Element border','The border thickness at the element’s top, right, bottom and left edges.'],
    'Display / gap':['Display and gap','The element’s layout display mode and the gap between its layout items.'],
    'Font size / line height':['Text size and line height','The computed font size and line height of the selected element. Normal line height may not resolve to a pixel value.'],
    'Weight / letter spacing':['Text weight and spacing','The computed font weight and the additional spacing between characters.'],
    'Text contrast':['Text contrast','The calculated foreground-to-background contrast ratio and its typical target. Verify text over complex backgrounds visually.'],
    'Estimated chars / line':['Estimated line length','An estimate of how many characters fit on a line. Use it to review reading comfort alongside the actual rendered text.']
  };
  for(const [name,[title,text]] of Object.entries(metrics))add('metric:'+name,title,text);
  for (const [tab,title,text] of [
    ['diff','Differences','Review responsive findings, preview suggested fixes, compare with a baseline and export a report.'],
    ['log','Sync log','See how interactions were mirrored and matched across the connected previews.'],
    ['meta','Meta and social previews','Inspect page metadata, missing or duplicate tags, title and description lengths, and social-sharing cards.'],
    ['outline','Outline and measurements','Inspect headings, landmarks, keyboard order, element dimensions and best-practice suggestions.'],
    ['checks','Combined check results','Review automated findings and human visual decisions, then export a combined report.'],
    ['console','Preview console','Read messages and errors from all previews, grouped by message with a severity filter.']
  ]) add('panel:'+tab,title,text,`[data-tab="${tab}"],[data-panel="${tab}"],#pane-${tab} h2,#pane-${tab} h3`);
  for (const item of DEBUG_MENU) {
    if (item.id || item.sim !== undefined || item.action) {
      const kind=item.id?'tool':item.sim!==undefined?'sim':'action', value=item.id||item.sim||item.action||'';
      add('debug:'+kind+':'+value,item.label.replace('…','')+(item.note?' · '+item.note:''),item.info,`.debug-menu [data-${kind}="${value}"]`);
    }
  }
  for (const key of Object.keys(SYNC)) add('sync:'+key,'Sync '+SYNC[key][0], 'Mirror '+SYNC[key][0].toLowerCase()+' between linked previews. Unlinked screens keep their independent state.',`[data-sync="${key}"]`);
  const settings = {
    scheme:'Alternate light and dark colour-scheme preferences to compare the page’s own themes.',
    text:'Compare normal text with 200 percent text to reveal clipping and layout problems.',
    orientation:'Compare portrait and landscape orientation preferences on alternate previews.',
    motion:'Compare normal animation with the reduced-motion preference.',
    contrast:'Compare normal contrast with the increased-contrast preference.',
    print:'Compare normal screen rendering with the page’s print styles.',
    forced:'Compare normal colours with forced-colour rendering.',
    reduceddata:'Compare normal loading with the reduced-data preference.',
    transparency:'Compare normal rendering with the reduced-transparency preference.',
    gamut:'Compare standard and wide-colour gamut preferences.',
    rtl:'Compare the default layout with right-to-left direction to test international layouts.',
    lang:'Compare the default page language with the language configured below.'
  };
  for (const [value,text] of Object.entries(settings)) {
    const option=[...$('#screen-settings').options].find(o=>o.value===value);
    if(option) add('#screen-settings:'+value,option.textContent,text);
  }
  // These headings are app chrome, not content extracted from the site under test.
  for (const [selector,key] of [['#design-title','debug:action:design'],['#grid-title','debug:action:grid'],['#preview-scale-title','screen-scale'],['#annotation-note-title','note-edit'],['.command-heading h2','#search-tools'],['.empty h1','#demo'],['.outline-overlays legend','#outline-focus-overlay']]) rules.push([selector,key]);
  function resolve(element) {
    if (!(element instanceof Element) || element.closest('#feature-help') || element.closest('iframe')) return null;
    const original=window.samestateFeatureHelpIcons?.targetFor(element);if(original)return resolve(original)||entries.get(element.closest('.feature-help-trigger').dataset.helpKey)||null;
    let el=element;
    if (el.matches('label')) el=el.control || el.querySelector('input,select,textarea') || el;
    if (el.id && entries.has('#'+el.id)) {
      const option=['screen-settings','live-reload','ui-theme','theme-preset','outline-mode','shot-format'].includes(el.id) && entries.get('#'+el.id+':'+el.value);
      return option || entries.get('#'+el.id);
    }
    if(el.matches('.outline-metrics dt') && entries.has('metric:'+el.textContent))return entries.get('metric:'+el.textContent);
    if (el.matches('#sidebar>.sidebar-drawer>summary,#test-ai>summary,#preview-scale details>summary')) {
      const name=el.firstChild?.textContent.trim(); if(entries.has('section:'+name))return entries.get('section:'+name);
    }
    const result=el.closest('#command-list [data-i]');
    if(result){const c=commandList[Number(result.dataset.i)];if(c&&entries.has(c.id))return entries.get(c.id);}
    for (let i=rules.length-1;i>=0;i--) if(el.matches(rules[i][0]))return entries.get(rules[i][1])||null;
    const group=el.closest('.checks-group');
    if(group){const key='check-group:'+group.querySelector('input').value;return entries.get(key)||null;}
    return null;
  }
  for (const group of document.querySelectorAll('.checks-group')) {
    const input=group.querySelector('input'), title=group.querySelector('b')?.textContent, text=group.querySelector('small')?.textContent;
    if(input&&title&&text)add('check-group:'+input.value,title,text+'. Select this group to include it in a combined check run.');
  }
  window.samestateFeatureHelpCatalog = { resolve, entry: key => entries.get(key), entries: () => [...entries.values()] };
})();
