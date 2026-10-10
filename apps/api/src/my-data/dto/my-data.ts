import { Field, Float, ID, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum MyDataKind {
  PROFILE = 'profile',
  TAILORED_CV = 'tailored_cv',
  COVER_LETTER = 'cover_letter',
}
registerEnumType(MyDataKind, { name: 'MyDataKind', description: 'What a saved document is.' });

@ObjectType({ description: 'A saved document, without its content.' })
export class MyDataDocumentSummary {
  @Field(() => ID)
  id: string;

  @Field(() => MyDataKind)
  kind: MyDataKind;

  @Field({ description: 'e.g. "Senior Engineer · Brightpath".' })
  title: string;

  @Field()
  createdAt: Date;
}

@ObjectType({ description: "What is saved for an email: the newest profile, and the other documents' summaries." })
export class MyData {
  @Field(() => String, { nullable: true, description: 'The newest saved profile, as JSON. Null when no profile is saved.' })
  profile: string | null;

  @Field(() => [MyDataDocumentSummary], { description: 'Saved tailored CVs and cover letters, newest first.' })
  documents: MyDataDocumentSummary[];
}

@ObjectType({ description: 'A saved chunk of text close to the query.' })
export class MyDataMatch {
  @Field()
  text: string;

  @Field(() => Float, { description: 'Cosine similarity, from -1 to 1 (higher is closer).' })
  score: number;

  @Field(() => MyDataDocumentSummary)
  document: MyDataDocumentSummary;
}
