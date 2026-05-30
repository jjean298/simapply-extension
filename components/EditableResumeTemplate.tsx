import { ResumeData } from "../types/resume"

interface EditableResumeTemplateProps {
  resume: ResumeData
}

export function EditableResumeTemplate({ resume }: EditableResumeTemplateProps) {
  return (
    <div className="h-full w-full overflow-auto bg-white p-8 text-black">
      <div className="text-center">
        <h1
          className="text-2xl font-bold"
          contentEditable
          suppressContentEditableWarning
        >
          {resume.name}
        </h1>

        <p
          className="mt-1 text-xs"
          contentEditable
          suppressContentEditableWarning
        >
          {resume.headline}
        </p>

        <p className="mt-1 text-[10px] text-gray-700">
          {resume.contactLine}
        </p>

        <div className="mt-1 flex justify-center gap-3 text-[10px] text-blue-700">
          {resume.links.map((link, index) => (
            <a key={index} href={link.url} target="_blank">
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {resume.summary && (
        <section className="mt-5">
          <h2 className="border-b border-gray-400 pb-1 text-xs font-bold uppercase">
            Summary
          </h2>
          <p
            className="mt-2 text-[10px] leading-relaxed"
            contentEditable
            suppressContentEditableWarning
          >
            {resume.summary}
          </p>
        </section>
      )}

      {resume.experience.length > 0 && (
        <section className="mt-5">
          <h2 className="border-b border-gray-400 pb-1 text-xs font-bold uppercase">
            Experience
          </h2>

          {resume.experience.map((item, index) => (
            <div key={index} className="mt-3">
              <div className="flex justify-between gap-4">
                <div>
                  <p
                    className="text-[11px] font-bold"
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {item.company}
                  </p>
                  <p
                    className="text-[10px] italic"
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {item.role}
                  </p>
                </div>

                <p className="text-[9px] text-gray-600">{item.dates}</p>
              </div>

              <ul className="mt-1 list-disc space-y-1 pl-5 text-[10px] leading-snug">
                {item.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bulletIndex}
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.projects.length > 0 && (
        <section className="mt-5">
          <h2 className="border-b border-gray-400 pb-1 text-xs font-bold uppercase">
            Projects
          </h2>

          {resume.projects.map((project, index) => (
            <div key={index} className="mt-3">
              <p
                className="text-[11px] font-bold"
                contentEditable
                suppressContentEditableWarning
              >
                {project.name}
              </p>

              <ul className="mt-1 list-disc space-y-1 pl-5 text-[10px] leading-snug">
                {project.bullets.map((bullet, bulletIndex) => (
                  <li
                    key={bulletIndex}
                    contentEditable
                    suppressContentEditableWarning
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {resume.education.length > 0 && (
        <section className="mt-5">
          <h2 className="border-b border-gray-400 pb-1 text-xs font-bold uppercase">
            Education
          </h2>

          {resume.education.map((item, index) => (
            <div key={index} className="mt-2 text-[10px]">
              <p
                className="font-bold"
                contentEditable
                suppressContentEditableWarning
              >
                {item.school}
              </p>
              <p contentEditable suppressContentEditableWarning>
                {item.degree}
              </p>
              {item.details.map((detail, detailIndex) => (
                <p key={detailIndex}>{detail}</p>
              ))}
            </div>
          ))}
        </section>
      )}

      {resume.skills.length > 0 && (
        <section className="mt-5">
          <h2 className="border-b border-gray-400 pb-1 text-xs font-bold uppercase">
            Technical Skills
          </h2>

          <p
            className="mt-2 text-[10px] leading-relaxed"
            contentEditable
            suppressContentEditableWarning
          >
            {resume.skills.join(" | ")}
          </p>
        </section>
      )}

      {resume.certifications.length > 0 && (
        <section className="mt-5">
          <h2 className="border-b border-gray-400 pb-1 text-xs font-bold uppercase">
            Certifications
          </h2>

          <p
            className="mt-2 text-[10px] leading-relaxed"
            contentEditable
            suppressContentEditableWarning
          >
            {resume.certifications.join(" | ")}
          </p>
        </section>
      )}
    </div>
  )
}