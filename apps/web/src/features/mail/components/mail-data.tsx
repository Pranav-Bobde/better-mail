import type { MailMessage } from "@code-main/api/mail/contracts";
import type { ReactNode } from "react";

export const mails = [
  {
    id: "6c84fb90-12c4-11e1-840d-7b25c5ee775a",
    name: "William Smith",
    email: "williamsmith@example.com",
    subject: "Meeting Tomorrow",
    text: "Hi, let's have a meeting tomorrow to discuss the project. I've been reviewing the project details and have some ideas I'd like to share. It's crucial that we align on our next steps to ensure the project's success.\n\nPlease come prepared with any questions or insights you may have. Looking forward to our meeting!\n\nBest regards, William",
    date: "2023-10-22T09:00:00",
    read: true,
    labels: ["meeting", "work", "important"],
    threadId: "6c84fb90-12c4-11e1-840d-7b25c5ee775a",
  },
  {
    id: "110e8400-e29b-11d4-a716-446655440000",
    name: "Alice Smith",
    email: "alicesmith@example.com",
    subject: "Re: Project Update",
    text: "Thank you for the project update. It looks great! I've gone through the report, and the progress is impressive. The team has done a fantastic job, and I appreciate the hard work everyone has put in.\n\nI have a few minor suggestions that I'll include in the attached document.\n\nLet's discuss these during our next meeting. Keep up the excellent work!\n\nBest regards, Alice",
    date: "2023-10-22T10:30:00",
    read: true,
    labels: ["work", "important"],
    threadId: "110e8400-e29b-11d4-a716-446655440000",
  },
  {
    id: "3e7c3f6d-bdf5-46ae-8d90-171300f27ae2",
    name: "Bob Johnson",
    email: "bobjohnson@example.com",
    subject: "Weekend Plans",
    text: "Any plans for the weekend? I was thinking of going hiking in the nearby mountains. It's been a while since we had some outdoor fun.\n\nIf you're interested, let me know, and we can plan the details. It'll be a great way to unwind and enjoy nature.\n\nLooking forward to your response!\n\nBest, Bob",
    date: "2023-04-10T11:45:00",
    read: true,
    labels: ["personal"],
    threadId: "3e7c3f6d-bdf5-46ae-8d90-171300f27ae2",
  },
  {
    id: "61c35085-72d7-42b4-8d62-738f700d4b92",
    name: "Emily Davis",
    email: "emilydavis@example.com",
    subject: "Re: Question about Budget",
    text: "I have a question about the budget for the upcoming project. It seems like there's a discrepancy in the allocation of resources.\n\nI've reviewed the budget report and identified a few areas where we might be able to optimize our spending without compromising the project's quality.\n\nI've attached a detailed analysis for your reference. Let's discuss this further in our next meeting.\n\nThanks, Emily",
    date: "2023-03-25T13:15:00",
    read: false,
    labels: ["work", "budget"],
    threadId: "61c35085-72d7-42b4-8d62-738f700d4b92",
  },
  {
    id: "8f7b5db9-d935-4e42-8e05-1f1d0a3dfb97",
    name: "Michael Wilson",
    email: "michaelwilson@example.com",
    subject: "Important Announcement",
    text: "I have an important announcement to make during our team meeting. It pertains to a strategic shift in our approach to the upcoming product launch. We've received valuable feedback from our beta testers, and I believe it's time to make some adjustments to better meet our customers' needs.\n\nThis change is crucial to our success, and I look forward to discussing it with the team. Please be prepared to share your insights during the meeting.\n\nRegards, Michael",
    date: "2023-03-10T15:00:00",
    read: false,
    labels: ["meeting", "work", "important"],
    threadId: "8f7b5db9-d935-4e42-8e05-1f1d0a3dfb97",
  },
  {
    id: "1f0f2c02-e299-40de-9b1d-86ef9e42126b",
    name: "Sarah Brown",
    email: "sarahbrown@example.com",
    subject: "Re: Feedback on Proposal",
    text: "Thank you for your feedback on the proposal. It looks great! I'm pleased to hear that you found it promising. The team worked diligently to address all the key points you raised, and I believe we now have a strong foundation for the project.\n\nI've attached the revised proposal for your review.\n\nPlease let me know if you have any further comments or suggestions. Looking forward to your response.\n\nBest regards, Sarah",
    date: "2023-02-15T16:30:00",
    read: true,
    labels: ["work"],
    threadId: "1f0f2c02-e299-40de-9b1d-86ef9e42126b",
  },
  {
    id: "17c0a96d-4415-42b1-8b4f-764efab57f66",
    name: "David Lee",
    email: "davidlee@example.com",
    subject: "New Project Idea",
    text: "I have an exciting new project idea to discuss with you. It involves expanding our services to target a niche market that has shown considerable growth in recent months.\n\nI've prepared a detailed proposal outlining the potential benefits and the strategy for execution.\n\nThis project has the potential to significantly impact our business positively. Let's set up a meeting to dive into the details and determine if it aligns with our current goals.\n\nBest regards, David",
    date: "2023-01-28T17:45:00",
    read: false,
    labels: ["meeting", "work", "important"],
    threadId: "17c0a96d-4415-42b1-8b4f-764efab57f66",
  },
] satisfies readonly MailMessage[];

export type Mail = MailMessage;

export const accounts = [
  {
    label: "Alicia Koch",
    email: "alicia@example.com",
    icon: <GmailIcon />,
  },
  {
    label: "Alicia Koch",
    email: "alicia@gmail.com",
    icon: <GmailIcon />,
  },
] satisfies readonly [
  {
    readonly email: string;
    readonly icon: ReactNode;
    readonly label: string;
  },
  ...{
    readonly email: string;
    readonly icon: ReactNode;
    readonly label: string;
  }[],
];

export function GmailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
        fill="currentColor"
      />
    </svg>
  );
}
